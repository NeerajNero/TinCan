/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { initializeApp } from "firebase/app";
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";
import { defaultCache } from "@serwist/turbopack/worker";
import { Serwist, type PrecacheEntry, type SerwistGlobalConfig } from "serwist";

// `self.__SW_MANIFEST` is replaced with the precache manifest at build time.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
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

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data as { url?: string } | undefined)?.url ?? "/", self.location.origin).href;
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
