/**
 * Content-Security-Policy, built from what the code actually loads. Set per
 * request by src/proxy.ts (it needs a fresh nonce: Next's inline bootstrap
 * scripts change per route and build, so they can't be hashed, and
 * script-src has no 'unsafe-inline').
 *
 * Remember the service worker: any request it handles with respondWith() is a
 * fetch() from the worker and is governed by connect-src, not img-src or
 * media-src. src/app/sw.ts routes Cloudinary, OSM tiles, GIPHY and ytimg
 * (CacheFirst) and Firebase/Google APIs (NetworkOnly); everything else
 * cross-origin bypasses the worker. Hosts are listed in connect-src too where
 * the worker or fetch() touches them.
 */
import { RADIO_HLS_ORIGINS, RADIO_MEDIA_ORIGINS } from "./src/lib/radio";

const unique = (xs: string[]) => [...new Set(xs.filter(Boolean))];
const host = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
};

/**
 * Firestore's WebChannel transport probes connectivity with
 * `https://www.google.com/images/cleardot.gif` (an <img>, so img-src) when a
 * stream fails, which is how it decides to fall back to long-polling on
 * networks that break WebChannel. Path-limited: nothing else on google.com.
 */
export const FIRESTORE_PROBE_IMG = "https://www.google.com/images/";

/** The two YouTube player origins (watch/listen together embed the nocookie one; the API script comes from www). */
const YOUTUBE_ORIGINS = ["https://www.youtube-nocookie.com", "https://www.youtube.com"];

/**
 * Permissions-Policy (static, set in next.config.ts). Playback features are
 * delegated to the YouTube iframe: with `autoplay=(self)` the browser denies
 * the embed autoplay even though the iframe asks for it, so remote play and
 * our own Play button (a tap in *our* frame) were treated as blocked autoplay.
 * Everything else stays off; the microphone is ours only (voice notes).
 */
export function buildPermissionsPolicy(): string {
  const yt = YOUTUBE_ORIGINS.map((o) => `"${o}"`).join(" ");
  const playback = `(self ${yt})`;
  return [
    "accelerometer=()",
    `autoplay=${playback}`,
    "camera=()",
    "display-capture=()",
    `encrypted-media=${playback}`,
    `fullscreen=${playback}`,
    "geolocation=()",
    "gyroscope=()",
    "magnetometer=()",
    "microphone=(self)",
    "midi=()",
    "payment=()",
    `picture-in-picture=${playback}`,
    "publickey-credentials-get=()",
    "screen-wake-lock=()",
    "usb=()",
    "xr-spatial-tracking=()",
  ].join(", ");
}


interface CspEnv {
  /** Per-request nonce from src/proxy.ts; Next stamps it on its inline bootstrap scripts, the layout on the theme script. */
  nonce: string;
  projectId?: string;
  authDomain?: string;
  databaseUrl?: string;
  dev?: boolean;
}

/** Every host a page fetch(), WebSocket or the service worker's routes may contact. */
function connectSrc(databaseUrl?: string): string[] {
  const dbHost = databaseUrl ? host(databaseUrl) : "";
  return unique([
    "'self'",
    // Firebase: Firestore, Auth (identitytoolkit, securetoken), installations, FCM registration, RTDB.
    "https://firestore.googleapis.com",
    "https://*.googleapis.com",
    "https://*.firebasedatabase.app",
    "wss://*.firebasedatabase.app",
    "https://*.firebaseio.com",
    "wss://*.firebaseio.com",
    dbHost ? `https://${dbHost}` : "",
    dbHost ? `wss://${dbHost}` : "",
    // Uploads, and the worker's image caches.
    "https://api.cloudinary.com",
    "https://res.cloudinary.com",
    "https://*.giphy.com",
    "https://api.open-meteo.com",
    "https://geocoding-api.open-meteo.com",
    "https://www.youtube.com", // oEmbed titles
    "https://i.ytimg.com",
    "https://*.ytimg.com",
    "https://*.googleusercontent.com",
    "https://tile.openstreetmap.org",
    "https://*.tile.openstreetmap.org",
    // Radio over hls.js (desktop browsers without native HLS) fetches playlists and segments.
    // Plain mp3/aac and native HLS play through <audio>: media-src only. The worker never touches streams.
    ...RADIO_HLS_ORIGINS,
  ]);
}

/**
 * The service worker's own policy (it comes from the worker script's response
 * headers, not the page's). Its fetches for the runtime caches are connect-src.
 */
export function buildWorkerCsp(databaseUrl?: string): string {
  return [
    `default-src 'self'`,
    `script-src 'self'`,
    `img-src 'self' ${FIRESTORE_PROBE_IMG}`,
    `connect-src ${connectSrc(databaseUrl).join(" ")}`,
  ].join("; ");
}

export function buildCsp({ nonce, projectId, authDomain, databaseUrl, dev = false }: CspEnv): string {
  const dbHost = databaseUrl ? host(databaseUrl) : "";
  // The Realtime Database falls back to long-polling when a WebSocket fails (common on mobile
  // networks), and then *sticks* to it on that device (localStorage previous_websocket_failure).
  // Long-polling loads <script src="https://<db>/.lp?…"> inside a hidden iframe and pings
  // disconnects through an iframe, so the database hosts must be in script-src and frame-src.
  const rtdbTransport = unique(["https://*.firebasedatabase.app", "https://*.firebaseio.com", dbHost ? `https://${dbHost}` : ""]);
  const firebaseAuthFrames = unique([projectId ? `https://${projectId}.firebaseapp.com` : "", authDomain ? `https://${authDomain}` : ""]);

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'"],
    "manifest-src": ["'self'"],
    "worker-src": ["'self'", "blob:"],
    "script-src": unique([
      "'self'",
      `'nonce-${nonce}'`,
      "https://www.youtube.com", // iframe_api + www-widgetapi.js
      "https://s.ytimg.com",
      "https://apis.google.com",
      ...rtdbTransport,
      dev ? "'unsafe-eval'" : "",
    ]),
    "style-src": ["'self'", "'unsafe-inline'"],
    "font-src": ["'self'"],
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      "https://res.cloudinary.com",
      "https://*.giphy.com",
      "https://i.ytimg.com",
      "https://*.ytimg.com",
      "https://*.googleusercontent.com",
      "https://tile.openstreetmap.org",
      "https://*.tile.openstreetmap.org",
      FIRESTORE_PROBE_IMG,
    ],
    "media-src": ["'self'", "blob:", "https://res.cloudinary.com", ...RADIO_MEDIA_ORIGINS],
    "frame-src": [...firebaseAuthFrames, "https://accounts.google.com", "https://www.youtube.com", "https://www.youtube-nocookie.com", ...rtdbTransport],
    "connect-src": connectSrc(databaseUrl),
  };
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(" ")}`)
    .join("; ");
}
