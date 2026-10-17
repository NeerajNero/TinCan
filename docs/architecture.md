# Architecture

## Stack

- **Next.js 16** (App Router, Turbopack), TypeScript, Tailwind v4. Everything under `src/`.
- **PWA** via Serwist: worker source at `src/app/sw.ts`, served at `/serwist/sw.js` by `src/app/serwist/[path]/route.ts`. The same worker carries the FCM background handler; the public Firebase config is inlined into it with esbuild `define` at build time. Disabled under `next dev`.
- **Firebase (Spark)**: Google sign-in, Firestore for everything persistent, Realtime Database for everything ephemeral, Cloud Messaging sent from API routes with `firebase-admin`.
- **Cloudinary** for photos and voice notes (signed uploads, see security.md). **Open-Meteo** for weather and geocoding, **OpenStreetMap** tiles via Leaflet, **YouTube IFrame** for watch/listen, **GIPHY** (optional key), six public **radio** streams.
- **Vercel Hobby** hosts it; **cron-job.org** pings `/api/tick` every 15 minutes.

## Request/response boundaries

| Layer | Lives in | Talks to |
| --- | --- | --- |
| Client components | `src/components/**`, `src/hooks/**` | Firestore + RTDB directly (rules enforce access), our API routes with an ID token |
| Client libraries | `src/lib/**` (not `server/`, not `firebase/admin.ts`) | pure helpers and the client SDKs |
| API routes | `src/app/api/**` | `firebase-admin`, Cloudinary admin, FCM. Always through `src/lib/server/guard.ts` |
| Server libraries | `src/lib/server/**`, `src/lib/firebase/admin.ts` | server only (`import "server-only"`) |

Nothing under `src/components`, `src/hooks` or the client half of `src/lib` may import `firebase-admin`.

## Provider tree (what wraps every signed-in screen)

```
<Providers>                     Serwist registration, ThemeProvider, AuthProvider
  <AuthGate>                    allowlist check via POST /api/gate; routes to /signin
    <PresenceController/>       presence/{me}: online, heartbeat, onDisconnect, page
    <PairProvider>              pair/main, users/{me}, users/{friend}; onboarding; "pair full"
      <ChatMetaProvider>        unread badge query (≤99) + latest message (limit 1)
        <ToastProvider>         one toast stack for the whole app
          <PresenceProvider>    friend's presence node, in its own context so heartbeats re-render only presence UI
            <LiveEventsProvider>  pings queue, lamp, open games, today's daily doc, garden unlocks → toasts
              <PushController/>   token refresh + foreground pushes → toasts, only once push is enabled (lazy firebase/messaging)
              <AppShell>          h-dvh column: offline banner, scrolling <main>, tab bar
```

`<Providers>` also wraps everything in framer-motion's `<LazyMotion>` with a lazily imported `domMax` bundle, so components use `m.*` and the full `motion` runtime never ships in a route chunk.

Every screen reads shared data through these hooks: `usePair()`, `useChatMeta()`, `useLiveEvents()`, `useFriendPresence()`, `useToast()`. **Never re-subscribe per component to something a provider already holds.**

## Rendering and CSP

Every page is **dynamically rendered**: `src/proxy.ts` puts a fresh CSP nonce on each page request and the root layout reads it (`headers()`), which opts all routes out of static prerendering. That is the price of a `script-src` without `'unsafe-inline'`. Each navigation is a Vercel function invocation, well inside Hobby's free allowance for two users. The service worker still precaches `/offline` and the static assets. The policy itself lives in `csp.ts`.

## Layout

The document never scrolls. `html`/`body` are clamped in `globals.css`; `AppShell` is `fixed inset-0` (centred 480 px column) whose `<main>` is the only scroller, with the tab bar as the last flex row. Pages outside the shell use the `screen-fixed` utility. `useDocumentScrollLock` (mounted in `Providers`) snaps the layout viewport back to 0,0 on any `visualViewport` scroll/resize, and focus goes through `focusNoScroll` so Android's scroll-into-view can't move the page. Sheets and overlays are portalled to `<body>` (`ui/Sheet`, `ui/Portal`) with one z-index scale (`Z`). `tests/e2e/layout.spec.ts` guards the lock.

## Realtime split

- **Firestore** holds anything that must survive: messages, journal, memories, lists, results, the pair doc. All listeners are bounded (`limit(n)` or a single doc) — see data-model.md for the full table.
- **RTDB** holds anything high-frequency or ephemeral: presence, typing, the ping queue, lamps, cursors, live boards, canvases, watch/listen sync, timers, deck state. Listeners are attached only while the screen using them is mounted; the only app-wide RTDB listeners are presence (friend), pings (me), lamp (me), open games and the connection probe.

## Mirrored summaries (how Home stays cheap)

Home may subscribe only to `pair/main`, `users/{friend}`, today's `checkins`, today's two `moods`, today's `dailyQuestions` doc and the latest message. So small summaries are mirrored onto `pair/main` by the client that writes the source:

- `milestonesSummary[]` → Home "Next up" card
- `tripsSummary[]` → countdown fallback (Home, Plan hero, tick reminder)
- `records{}` → Play record strip
- `garden.stickers{}` → garden unlock toasts
- `pet{}`, `streak{}`, `plant{}`, `focusSessions{}`, `counters.pings`

## Metered Firestore

Firestore is initialised in `lib/firebase/client.ts` with persistent multi-tab cache and `experimentalAutoDetectLongPolling: true` (the SDK default, made explicit): on networks that break the streaming WebChannel transport it probes `www.google.com/images/cleardot.gif` and falls back to long-polling. `lib/firestoreHealth.ts` counts server → cache transitions of the `pair/main` listener for More → Diagnostics.

All client code imports Firestore from `@/lib/firebase/fs`, a thin re-export of `firebase/firestore` that counts server-served reads and writes. More → Usage meter extrapolates the session to a day against the Spark quota. Importing from `firebase/firestore` directly in client code bypasses the meter and is wrong.

## Push notifications

Data-only FCM messages (no `notification` key) so the worker alone decides what to show. `src/lib/pushTypes.ts` is the single map from push type → More toggle → title/body/url, shared by the client's `notify()`, `/api/push` and `/api/tick`. The server skips a push when the recipient's presence page is already the target route (chat, a game).

## Bundle budget

`pnpm analyze` (`ANALYZE=true next build`) writes the Turbopack bundle report. Measured on the prerendered `/chat` HTML (module scripts only, gzip): about 480 KB, of which Firebase is ~230 KB and React ~70 KB. Things deliberately kept off the initial path: `firebase/messaging` (loaded when push is enabled), `browser-image-compression` (first upload), `chess.js` (game screen only, through `lib/games/all.ts`), Leaflet, YouTube, the together screens (`play/together/lazy.tsx`) and the open playlist's rows (`PlaylistRows`, loaded when the section opens, since `Reorder` pulls in framer-motion's layout runtime, ~20 KB gzip). Client API schemas use `zod/mini`.

## Service worker caching

`src/app/sw.ts`: precache of the build + `/offline`; runtime CacheFirst for `res.cloudinary.com` (30 days, 500 entries), OSM tiles (7 d, 300), GIPHY (7 d, 150) and ytimg (7 d, 150) with opaque responses allowed so cached photos display offline; NetworkOnly for `/api/*`, Firebase and Google hosts.

## Scheduler

`GET /api/tick` (header `x-tick-secret`) runs idempotent jobs keyed in `tickLog/{jobKey}`: scheduled messages, 20:00 daily-question nudge, 21:00 streak warning, capsule unlocks, 09:00 milestone/meetup reminders, abandoned/finished-game housekeeping, pet hunger. Time-of-day jobs fire inside a 15-minute window. `?dry=1` reports without writing.
