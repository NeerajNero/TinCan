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
          <LiveEventsProvider>  pings queue, lamp, friend presence, open games, today's daily doc, garden unlocks → toasts
            <PushController/>   FCM token refresh + foreground pushes → toasts (skips live-covered types)
            <AppShell>          h-dvh column: offline banner, scrolling <main>, tab bar
```

Every screen reads shared data through these hooks: `usePair()`, `useChatMeta()`, `useLiveEvents()`, `useToast()`. **Never re-subscribe per component to something a provider already holds.**

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

All client code imports Firestore from `@/lib/firebase/fs`, a thin re-export of `firebase/firestore` that counts server-served reads and writes. More → Usage meter extrapolates the session to a day against the Spark quota. Importing from `firebase/firestore` directly in client code bypasses the meter and is wrong.

## Push notifications

Data-only FCM messages (no `notification` key) so the worker alone decides what to show. `src/lib/pushTypes.ts` is the single map from push type → More toggle → title/body/url, shared by the client's `notify()`, `/api/push` and `/api/tick`. The server skips a push when the recipient's presence page is already the target route (chat, a game).

## Scheduler

`GET /api/tick` (header `x-tick-secret`) runs idempotent jobs keyed in `tickLog/{jobKey}`: scheduled messages, 20:00 daily-question nudge, 21:00 streak warning, capsule unlocks, 09:00 milestone/meetup reminders, abandoned/finished-game housekeeping, pet hunger. Time-of-day jobs fire inside a 15-minute window. `?dry=1` reports without writing.
