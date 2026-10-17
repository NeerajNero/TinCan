/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import { initializeApp } from "firebase/app";
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";
import { CacheableResponsePlugin, CacheFirst, ExpirationPlugin, NetworkOnly, Serwist, type PrecacheEntry, type RuntimeCaching, type SerwistGlobalConfig } from "serwist";

import { RADIO_HOSTNAMES } from "../lib/radio";

// `self.__SW_MANIFEST` is replaced with the precache manifest at build time.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const DAY = 24 * 60 * 60;

/** Images and tiles are cached first (they're immutable URLs); anything that talks to Firebase, Google or our API never is. */
const imageCache = (cacheName: string, maxEntries: number, maxAgeSeconds: number) =>
  new CacheFirst({
    cacheName,
    // Cross-origin <img> responses are opaque (status 0); allow them so cached photos show offline.
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] }), new ExpirationPlugin({ maxEntries, maxAgeSeconds, purgeOnQuotaError: true })],
  });

function isCrossOriginCatchAll(route: RuntimeCaching): boolean {
  const cacheName = (route.handler as { cacheName?: string }).cacheName;
  return cacheName === "cross-origin" || (route.matcher instanceof RegExp && route.matcher.source === ".*");
}

const runtimeCaching: RuntimeCaching[] = [
  { matcher: ({ url }) => url.pathname.startsWith("/api/"), handler: new NetworkOnly() },
  {
    matcher: ({ url }) => url.hostname.endsWith(".googleapis.com") || url.hostname.endsWith(".firebaseio.com") || url.hostname.endsWith(".firebasedatabase.app"),
    handler: new NetworkOnly(),
  },
  { matcher: ({ url }) => url.hostname === "res.cloudinary.com", handler: imageCache("tincan-cloudinary", 500, 30 * DAY) },
  { matcher: ({ url }) => url.hostname.endsWith("tile.openstreetmap.org"), handler: imageCache("tincan-osm-tiles", 300, 7 * DAY) },
  { matcher: ({ url }) => url.hostname.endsWith(".giphy.com"), handler: imageCache("tincan-giphy", 150, 7 * DAY) },
  { matcher: ({ url }) => url.hostname.endsWith("ytimg.com"), handler: imageCache("tincan-ytimg", 150, 7 * DAY) },
  // Serwist's defaults minus its two cross-origin catch-alls (the "cross-origin" NetworkFirst and the
  // final /.*/ NetworkOnly). They made the worker fetch every other cross-origin request (Google
  // avatars, YouTube scripts, even the endless radio streams, which NetworkFirst tried to cache), all
  // under connect-src. Unrouted cross-origin requests now go straight to the network, governed by
  // the page's img-src / script-src / media-src.
  ...defaultCache.filter((route) => !isCrossOriginCatchAll(route)),
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

// Radio streams (playlists, segments, endless mp3) never go through the worker: registered before
// Serwist's fetch listener, this stops it without respondWith(), so the browser fetches them itself.
self.addEventListener("fetch", (event) => {
  if (RADIO_HOSTNAMES.has(new URL(event.request.url).hostname)) event.stopImmediatePropagation();
});

serwist.addEventListeners();

/* ── FCM background messages ─────────────────────────────────────────────
 * The public Firebase config is inlined here at build time: the route handler
 * passes esbuild `define`s for each NEXT_PUBLIC_FIREBASE_* value (see
 * src/app/serwist/[path]/route.ts). Pushes are data-only, so this handler is
 * the only thing that ever shows a notification.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (firebaseConfig.apiKey && firebaseConfig.appId) {
  const messaging = getMessaging(initializeApp(firebaseConfig));
  onBackgroundMessage(messaging, (payload) => {
    const d = payload.data ?? {};
    const title = d.title || "Tincan";
    const url = d.url || "/";
    void self.registration.showNotification(title, {
      body: d.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: d.tag || d.type || "tincan",
      data: { url },
    });
  });
}

/* ── updates & diagnostics ─────────────────────────────────────────────── */
// The build this worker came from (inlined by the route handler), for More → Diagnostics.
const WORKER_BUILD = process.env.NEXT_PUBLIC_BUILD_ID || "dev";

self.addEventListener("message", (event) => {
  const data = event.data as { type?: string } | undefined;
  if (data?.type === "SKIP_WAITING") void self.skipWaiting();
  if (data?.type === "VERSION") event.ports[0]?.postMessage({ build: WORKER_BUILD });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requested = new URL((event.notification.data as { url?: string } | undefined)?.url ?? "/", self.location.origin);
  // Never leave our origin from a notification click.
  const target = requested.origin === self.location.origin ? requested.href : `${self.location.origin}/`;
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) {
        if (!client.url.startsWith(self.location.origin)) continue;
        await client.focus();
        if (client.url !== target && "navigate" in client) await client.navigate(target);
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
