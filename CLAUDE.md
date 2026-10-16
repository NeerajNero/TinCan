# Tincan — a private app for two long-distance friends

## What this is
A two-user web app (installable PWA, mobile-first) that two close friends in different cities
use to stay connected: WhatsApp-style chat, live presence, pings, games, things to do together
in real time, shared memories, planning, and a shared pet/plant they look after.

Exactly two users, ever. Everything is private to them. Total running cost must stay ₹0.
Tone: cute and playful. Working name "Tincan" (tin-can telephone); rename is cosmetic.

Design principle: every feature should take under 10 seconds to use on a phone. Opening the
app should feel like a small hello, not a dashboard.

## Stack (do not deviate without asking)
- Next.js (App Router, TypeScript, Tailwind v4), `src/` layout, pnpm. Latest stable Next;
  it uses Turbopack and rewrites AGENTS.md on `next dev` — leave AGENTS.md alone, CLAUDE.md is the spec.
- PWA: installable on Android (manifest, icons, maskable icon), service worker that caches the
  app shell and receives FCM push. Use Serwist via `@serwist/turbopack`: worker source at
  `src/app/sw.ts`, served at `/serwist/sw.js` with scope `/` by a route handler, precaching the
  build output plus `/offline`, disabled in dev. The FCM background handler lives in this same
  worker (no separate `firebase-messaging-sw.js`), and `getToken` must be passed this worker's
  registration explicitly. Both users are on Android; iOS quirks can be ignored.
- Firebase, Spark (free) plan only:
  - Auth — Google provider. Only emails in `ALLOWED_EMAILS` may use the app; enforce in
    security rules AND in the client gate.
  - Firestore — everything persistent (chat, journal, lists, memories, results).
  - Realtime Database (RTDB) — everything ephemeral/high-frequency (presence, typing, pings,
    lamp, cursors, live game boards, canvases, watch/listen sync, timers).
  - Cloud Messaging (FCM) — web push, VAPID key, sent from Next API routes via `firebase-admin`.
  - NEVER use Cloud Functions, Firebase Storage, Extensions, or anything requiring Blaze.
- Cloudinary (free): all photos and voice notes. Unsigned upload presets from the browser;
  API secret only in server routes (deletes). No Firebase Storage.
- Vercel Hobby. Next API routes host the server bits. NEVER add `crons` to vercel.json
  (Hobby cron is daily-only); scheduling is `GET /api/tick` pinged every 15 min by cron-job.org.
- Free third-party data with no keys: Open-Meteo (weather + geocoding), OpenStreetMap tiles via
  Leaflet (memory map), YouTube IFrame Player (watch/listen together), public radio stream URLs.
  GIPHY is optional (`NEXT_PUBLIC_GIPHY_API_KEY`); hide the GIF button when the key is absent.
- Libraries: `firebase`, `firebase-admin`, `framer-motion`, `chess.js`, `leaflet` + `react-leaflet`,
  `browser-image-compression`, `date-fns` + `date-fns-tz`, `zod`, `lucide-react`. Add others only
  when clearly needed and free.

## Users, pairing, identity
- Two fixed users. `ALLOWED_EMAILS=a@gmail.com,b@gmail.com`. First sign-in creates `users/{uid}`.
- A single pair document `pair/main` holds both uids and shared config. There are no rooms,
  invites or codes — the allowlist is the pairing.
- "me" and "friend" are derived client-side from `pair/main.uids` minus my uid. Every screen
  shows the friend's nickname, never their email.
- `ROOM_TZ` (stored on `pair/main`, default the first user's tz) defines the shared day for
  daily things (daily question, daily word, check-ins, streak). Per-person things (mood) use the
  person's own tz. `dateKey` = `yyyy-MM-dd` in the relevant tz.

## Screens (bottom tab bar: Home · Chat · Play · Memories · Plan · More)
**Home** — the hello screen
- Presence card: friend's avatar, online dot / "last seen 12 min ago", awake/sleeping badge,
  their local time and weather (Open-Meteo by their city), distance between the two cities.
- Ping row: 4 big bouncy buttons — Thinking of you 💭, Hug 🤗, High-five ✋, Wave 👋.
  Sending animates on both screens, vibrates the receiver (`navigator.vibrate`), sends push.
- Lamp: tap my lamp → friend's lamp glows the same colour for 10 min (RTDB). Long-press picks colour.
- Mood check-in: pick today's emoji + optional one-liner; shows friend's today mood.
- Daily question card: today's prompt; answer box; friend's answer revealed only after I answer.
- Streak + plant: consecutive days both opened the app; plant SVG stage grows with it.
- Pet widget: shared pet sprite + hunger/happiness bars + Feed/Play buttons.
- Countdown: days until next meetup (from `pair/main.nextMeetup`).
- Sleep/wake toggle: "Good night" / "Good morning" — sets status and posts a system message.

**Chat** — WhatsApp-like, single conversation (spec in its own section below).

**Play** — two sections
- Games: Tic-tac-toe, Connect Four, Chess, Checkers, Pictionary, Trivia duel, Daily word,
  Know-me quiz, Would You Rather, Never Have I Ever, Truth or Dare, Conversation cards,
  20 Questions, Hangout-idea wheel.
- Together: Whiteboard, Pixel art, Watch together, Listen together, Radio, Focus timer, Cook-along.

**Memories** — Photo timeline, Memory map, Milestones, Journal, Jar, Time capsules,
Open-when envelopes, Mood history (calendar for both).

**Plan** — Meetup countdown, Call-time finder, Lists (bucket, wishlist, gift ideas, to-do), Trips.

**More** — Profile (nickname, city, avatar), Theme, Notification toggles, Friends-since date,
Next meetup, Pet name, Usage meter (today's Firestore read/write estimate), Sign out.

## Design
- Cute & playful: rounded 20px cards, soft pastel palette with one accent per tab, large emoji
  as icons where natural, gentle bounce/spring animations (Framer Motion), confetti on wins,
  tiny sound effects (toggleable, off by default), haptics on pings.
- Fonts via Google Fonts with system fallbacks: Fredoka (headings), Nunito (body).
- Light and dark themes (dark is a cosy navy, not pure black). Respect `prefers-color-scheme`,
  overridable in More.
- Mobile-first; desktop just centres a 480px column. Safe-area insets respected.
- The document never scrolls: html/body are `height: 100%; overflow: hidden; overscroll-behavior: none`.
  The app shell is `position: fixed; inset: 0` with `<main>` as the only scroller and the tab bar as its
  last row; screens outside the shell (sign-in, onboarding, splash, offline…) use the `screen-fixed`
  utility. Focus with `focusNoScroll` / `autoFocusRef` (`src/lib/focus.ts`), never bare `.focus()` or
  `autoFocus` on raw elements (`Input` handles `autoFocus` itself). `useDocumentScrollLock` resets any
  layout-viewport drift. Guarded by `pnpm test:e2e`.
- Every bottom sheet or menu is `src/components/ui/Sheet.tsx` (portal to body, scrim, safe-area bottom,
  above the tab bar/header/Leaflet). Any other `position: fixed` overlay goes through `Portal`, with its
  z-index from `Z` in `src/components/ui/Portal.tsx`: a transformed, filtered or backdrop-blurred ancestor
  would otherwise become its containing block.
- Empty states are friendly and suggest an action ("No photos yet — add the first one?").
- Avoid generic SaaS-dashboard looks: no data tables on Home, no grey card grids.
- Chat backgrounds are per user (`users/{me}.chatBg`): eight CSS-only built-ins in
  `src/content/chat-backgrounds.ts` (gradient + inline SVG pattern < 2 KB, light and dark variants) or a
  photo from Memories (Cloudinary `w_600,q_auto:low` with a dim overlay). Rendered as one absolutely
  positioned layer behind the message list, never `background-attachment: fixed`. Bubbles use the opaque
  `--bubble-mine` / `--bubble-theirs` tokens plus a subtle shadow so they read on any option.
- Motion: import `m` from framer-motion (never `motion`); `<LazyMotion>` in Providers loads `domMax` lazily.
- Images: never `next/image` with remote sources (Vercel Hobby meters optimisation). Cloudinary photos go
  through `CloudImage` (320/640 srcset, blur-up placeholder, async decode, lazy); GIF/YouTube/local previews
  are plain `<img>`.

## Data model — Firestore
`users/{uid}`: name, nickname, email, photoURL, tz, city, lat, lng, fcmTokens[], notif{...}, createdAt
`pair/main`: uids[2], roomTz, friendsSince, nextMeetup{date,label,place}, relationship (preset id,
  default "friends"; see `src/content/relationships.ts`), theme,
  pet{name,species,hungerAt,happyAt,sleepAt,level,bornAt}, plant{stage,lastGrowthDate},
  garden{stickers[]}, streak{count,lastDateKey}
`messages/{id}`: senderId, type(text|image|voice|gif|sticker|system), text,
  media{url,publicId,w,h,durationMs,bytes}, replyTo{id,preview,senderId,type},
  reactions{uid:emoji}, status(sent|delivered|read), deliveredAt, readAt, editedAt,
  deletedFor[], deletedForEveryone, createdAt
`checkins/{dateKey}`: {uid:true}  — written once per user per day on app open
`moods/{dateKey}_{uid}`: emoji, note, at
`dailyQuestions/{dateKey}`: questionIndex, answers{uid:{text,at}}
`journal/{id}`: authorId, text, mood, media[], createdAt
`capsules/{id}`: authorId, title, body, media[], unlockAt, openedAt, openedBy
`envelopes/{id}`: authorId, forUid, label("sad","bored","miss me",...), body, openedAt
`scheduled/{id}`: senderId, text, sendAt, sentAt, messageId
`jar/{id}`: authorId, forUid, text, drawnAt
`memories/{id}`: uploaderId, url, publicId, w, h, caption, takenAt, placeId?, createdAt
`places/{id}`: name, lat, lng, kind(been|want), note, visitedAt, addedBy
`milestones/{id}`: title, date, repeatYearly, emoji
`lists/{kind}/items/{id}` (kind: bucket|wishlist|gifts|todo): text, addedBy, done, doneAt, note, url, order
  — `gifts` items are private to their author (rule-enforced: read/write only by `addedBy`)
`trips/{id}`: title, startDate, endDate, place, days[{date, stops[{time,name,note}]}]
`availability/{uid}`: slots{ "mon": [ "09:00","09:30",...] } in that user's tz
`gameResults/{id}`: game, players[], winnerId|null, score{}, startedAt, endedAt
`quizzes/{id}`: authorId, questions[{q, answer, decoys[3]}], takenBy{uid:{score,answers[],at}}
`wordle/{dateKey}_{uid}`: guesses[], solved, at
`trivia/{id}`: questionIds[10], answers{uid:[...]}, scores{}, startedAt
`recipes/{id}`: title, ingredients[], steps[], addedBy
`push/{id}`: (server-only log) toUid, type, sentAt   — for de-duplication, prune to last 200
`tickLog/{jobKey}`: ranAt — idempotency for /api/tick jobs

Static content lives in `src/content/*.json`, not the DB: daily questions (365+), word list
(5-letter, ~1500 answers + larger allowed list), trivia bank (300+ questions, 4 options each),
would-you-rather (150+), never-have-I-ever (150+), truth/dare (100+ each), conversation cards
(150+), hangout ideas (60+), pictionary words (300+), 20-questions secret words (200+),
pet species (3 SVG sprite sets × 4 moods), plant stages (10 SVGs), garden stickers (24 SVGs),
radio stations (6 public stream URLs with names).

## Data model — RTDB
`presence/{uid}`: {online, lastSeen, status(awake|sleeping), page}
`typing/{uid}`: timestamp (chat shows "typing…" while < 3 s old)
`pings/{uid}/{pushId}`: {from, kind, at} — a queue; the receiver animates each child (older ones are
  summarised in one toast) and deletes it after showing
`lamp/{uid}`: {on, color, until}
`cursors/{uid}`: {x, y, page, at} — only written on whiteboard/pixel pages, throttled 50 ms
`whiteboard/strokes/{id}`: {uid, color, width, points[[x,y]...]} — cap 500 strokes, Clear deletes all
`pixel/grid`: 32×32 as array of 1024 palette indices; `pixel/cursor/{uid}`
`games/{gameId}`: {type, state, turn, players, status, lastMoveAt, endReason(win|draw|resign|abandoned|cancelled)} — live boards
`cards/{deck}`: {index, flippedBy, at} — shared current card for deck games
`pictionary/{gameId}`: {drawerUid, word, startedAt, strokes…, guesses[], solvedAt}
`watch/main`: {videoId, playing, positionSec, updatedAt, by, title}
`listen/main`: same shape; `radio/main`: {stationId, playing, by}
`timer/main`: {mode(focus|break), endsAt, startedBy, running}
`cook/{recipeId}`: {checked{stepIdx:true}, by}
`twenty/{gameId}`: {holderUid, secret, questionsAsked, status}

## Chat — WhatsApp-like spec
- Single thread. Firestore listener on last 50 messages ordered by createdAt desc; "load older"
  paginates by 50. Never attach an unbounded listener.
- Send: write message with `status: sent` + `serverTimestamp()`, then POST `/api/push` with
  the message id. Optimistic render immediately.
- Ticks: ✓ sent → ✓✓ delivered (recipient's client sets `deliveredAt` when the message
  arrives in its listener, even in background) → ✓✓ blue read (recipient's client sets
  `readAt` when the chat screen is open AND `document.visibilityState === "visible"`).
- Typing indicator via `typing/{uid}` with 3-s expiry; throttle writes to one per 1.5 s.
- Reply/quote (swipe-right on a bubble on mobile), long-press menu: react (6 quick emoji +
  picker), reply, copy, edit (own, within 15 min), delete for me, delete for everyone (own).
- Deleted-for-everyone shows "This message was deleted". Edited shows "edited".
- Message types: text (with link preview-free auto-linking), image, voice, GIF (GIPHY if key),
  sticker (bundled SVG set), system (good night, game results, pet events, capsule unlocked).
- Day separators ("Today", "Yesterday", date), unread divider on open, jump-to-bottom FAB,
  unread count badge on the Chat tab, last-message preview on Home.
- Images: compress in browser (max 1080 px, ~0.3 MB, JPEG/WebP) → Cloudinary unsigned preset
  `tincan_image` → store `url`, `publicId`, `w`, `h`. Render with
  `f_auto,q_auto:low,w_800` transformation; thumbnails `w_320`. Tap for full-screen viewer with pinch-zoom.
- Voice: `MediaRecorder` `audio/webm;codecs=opus` at 32 kbps, max 2 min, hold-to-record with
  slide-to-cancel → Cloudinary preset `tincan_audio` (resource_type `video`) → bubble with
  play/pause, duration, simple progress bar, 1×/1.5× speed.
- Delete for everyone on media also calls `DELETE /api/media` (server, Cloudinary destroy).
- Offline: Firestore persistence enabled; queued sends show a clock icon until sent.
- Notifications: push on every new message unless the recipient is online with the chat
  visible. Body is the text or "📷 Photo" / "🎤 Voice note". Tapping opens /chat.

## Presence & realtime rules
- On sign-in: set `presence/{uid}.online=true`, register `onDisconnect()` to set
  `online=false, lastSeen=serverTimestamp`. Heartbeat `lastSeen` every 60 s while visible.
- `visibilitychange` hidden → online=false; visible → online=true.
- Detach every RTDB listener on route change (100-connection free limit; keep connections lean).
- Shared cursors and canvases subscribe only while on that page.

## Push notifications (FCM)
- The Serwist worker (`src/app/sw.ts`) handles background messages; foreground messages show an
  in-app toast (no system notification when the app is open on that screen).
- Master switch `users/{uid}.notif.enabled` (default false until the user turns it on in
  More → Notifications). While off the user holds no tokens and `/api/push` never sends to them.
- Token registration on first grant, stored in `users/{uid}.fcmTokens` (array, dedupe, prune
  invalid tokens on send failure).
- `POST /api/push` — verifies the caller's Firebase ID token, loads the friend's tokens, sends.
  Types and defaults (all toggleable in More → Notifications):
  message ✓, ping ✓, lamp ✓, your-turn ✓, friend answered daily question ✓, jar note ✓,
  capsule unlocked ✓, scheduled message ✓, pet hungry ✓, streak at risk ✓, milestone ✓,
  meetup countdown (7/1 day) ✓, pictionary/trivia invite ✓.
- De-duplicate with `push/{id}` keyed by event (e.g. `pet-hungry-2026-10-12`).

## Scheduler — `GET /api/tick`
- Secured by header `x-tick-secret === TICK_SECRET`. cron-job.org pings it every 15 min.
- Idempotent jobs, each writing `tickLog/{jobKey}` before sending:
  1. Deliver `scheduled` messages whose `sendAt <= now` (create message + push).
  2. 20:00 ROOM_TZ: nudge whoever hasn't answered today's daily question.
  3. 21:00 ROOM_TZ: if exactly one user checked in today → "streak at risk" push to the other.
  4. Pet: if hunger would hit 0 within 2 h → "pet is hungry" push (once per day).
  5. Capsules whose `unlockAt` just passed → push both.
  6. Milestones today / meetup in 7 days / 1 day → push both at 09:00 ROOM_TZ.
- Dry run: `pnpm tick:dry` prints what would be sent without sending.

## Media — Cloudinary
- Two unsigned presets created manually: `tincan_image` (folder `tincan/images`, incoming
  transformation `c_limit,w_1080,h_1080,q_auto:low`), `tincan_audio` (folder `tincan/audio`,
  resource type video). Client uploads with `fetch` to
  `https://api.cloudinary.com/v1_1/{cloud}/{image|video}/upload` using the preset.
- Server routes using `CLOUDINARY_API_SECRET`: `DELETE /api/media` (destroy by publicId; only
  the uploader may delete). Nothing else needs the secret.
- Show an upload progress ring; retry once on failure.

## Feature specs (brief)
- **Daily question**: index = days since epoch in ROOM_TZ mod list length. Reveal friend's answer
  after mine; push when friend answers. History in Memories.
- **Streak/plant**: client writes `checkins/{dateKey}.{uid}=true` on app open. Streak counts
  consecutive dateKeys with both uids. Plant stage = min(10, streak/3 + 1); a missed day wilts
  the SVG (droopy variant) but never resets the stage below 1.
- **Pet**: shared. Hunger and happiness are not stored as numbers; each is derived as
  `100 - minutes since lastAction / 14.4` clamped 0–100 (so 24 h to empty). Feed/Play set the
  timestamps. Level up every 7 streak days; sprite changes per level. Species chosen on first
  open by either user; name editable in More. Pet events post system messages.
- **Garden**: completing a together-activity (first whiteboard drawing, a watched video, a
  finished trivia round, etc.) unlocks a sticker placed on a shared garden scene (Memories tab).
- **Time capsules**: Firestore rule forbids reading `body` before `unlockAt` for the non-author
  (store body in a subdoc `capsules/{id}/private/body` with the time-gated rule).
- **Open-when envelopes**: addressed to the friend; sealed until they tap "open"; opening is
  one-way and timestamps; author gets a push.
- **Jar**: add notes for the friend; they draw one at random; drawn notes move to "drawn".
- **Scheduled messages**: compose with a date-time picker; cancellable until sent.
- **Journal**: alternating entries both can read, mood tag, optional photos.
- **Photo timeline**: masonry grid grouped by month; captions; optional link to a map place.
- **Memory map**: Leaflet + OSM tiles; pins "been" (green) and "want" (purple); tap to add; link memories.
- **Milestones**: list + "next up" on Home; yearly repeat; push on the day.
- **Call-time finder**: each sets weekly 30-min availability in their tz; overlap shown in both
  tz; "Propose" posts a chat message with the slot.
- **Lists**: four kinds, shared (gift ideas private to the author), check-off, reorder by drag, who-added avatar.
- **Trips**: simple day/stop planner; countdown on Home uses the nearest upcoming trip if
  `nextMeetup` is empty.
- **Turn-based games** (tic-tac-toe, connect four, chess via chess.js, checkers): lobby creates a
  game in RTDB, friend gets "your turn" pushes, results saved to `gameResults`, head-to-head
  record shown in Play. Rematch button.
- **Deck games** (Would You Rather, NHIE, Truth or Dare, Conversation cards): shared current
  card in RTDB; either flips; answers/votes stored on the card; running tally where it fits.
- **20 Questions**: one picks a secret (or random from list), the other asks in chat-like box
  with Yes/No/Sort-of buttons; 20-question counter; reveal.
- **Hangout wheel**: spinning wheel of virtual hangout ideas; result posts to chat with "Let's!"
- **Trivia duel**: 10 random questions from the bank, 15 s each, can be played live (both
  online, synced via RTDB) or async (each plays when free; results compare when both done).
- **Know-me quiz**: author writes questions about themselves with the right answer + decoys;
  friend takes it; score + reveal; both directions.
- **Daily word**: same 5-letter word for both (deterministic by dateKey); independent 6-guess
  games; after both finish, grids are compared and a 🏆 goes to fewer guesses.
- **Pictionary**: drawer sees the word, draws on shared canvas (RTDB strokes), guesser types;
  60 s; 3 rounds alternating; score.
- **Whiteboard**: pen/eraser/colours/clear, shared cursors, "snapshot" button uploads a PNG to
  Cloudinary and posts it to chat.
- **Pixel art**: 32×32 shared grid, 16-colour palette, shared cursors, snapshot to chat.
- **Watch together**: paste a YouTube URL; IFrame Player; play/pause/seek broadcast via RTDB;
  drift correction if >2 s apart; small side chat uses the main chat.
- **Listen together**: same mechanism, audio-only UI (hidden player, shows title/thumbnail),
  shared queue (RTDB list). **Radio**: 6 curated public stream URLs, synced play/pause.
- **Focus timer**: shared Pomodoro 25/5; both see the same countdown; chime at phase end.
- **Cook-along**: pick a recipe (both can add recipes); steps tick off live for both.
- **Mood history**: month calendar with both users' emoji per day.
- **Usage meter**: client counts Firestore reads/writes per session and estimates daily use vs
  the free quota; shows a friendly gauge in More. Purely informational.

## Security rules (must be written in Phase 2 and kept current)
- Firestore and RTDB: deny all by default; allow only if `request.auth.token.email` is in the
  allowlist (hard-code the two emails in the rules files; keep them in sync with `ALLOWED_EMAILS`).
- `users/{uid}`: write only by that uid. `fcmTokens` only by owner.
- `messages`: create only with `senderId == request.auth.uid`; `deliveredAt/readAt/status` only
  updatable by the non-sender; `text/editedAt/deletedForEveryone` only by sender; `reactions`
  and `deletedFor` by either, but a user may only set their own key.
- `capsules/{id}/private/body`: read allowed if author, or `request.time >= unlockAt`.
- `envelopes`: body readable by `forUid` only after `openedAt` is set by them, and by author always.
- `scheduled`: readable/deletable by sender only; delivery is done by the server (admin).
- `tickLog`, `push`: admin-only (no client access).
- RTDB: `presence/{uid}`, `typing/{uid}`, `cursors/{uid}`, `lamp/{uid}` writable only by `uid`;
  `pings/{uid}` writable by the other user; shared nodes writable by both allowlisted users.

## Security (phase 15a)
- API routes share one guard (`src/lib/server/guard.ts`): ID token verified with revocation
  checking, `email_verified` + allowlist required, bodies ≤ 16 KB and zod `.strict()`, an in-memory
  token bucket per uid per route, and a Firestore daily cap per uid (`quota/{uid}_{day}`, admin-only:
  push 1000, media/sign 300). `/api/tick` compares its secret with `timingSafeEqual`. Error bodies
  are minimal; details only in server logs.
- Cloudinary uploads are **signed**: `POST /api/media/sign` returns a signature for a fixed param set
  (timestamp, folder, preset, incoming transformation for images; 5 MB image / 3 MB audio cap
  checked before signing). Both presets must be in Signed mode in the console. The app only renders
  media from `https://res.cloudinary.com/<cloud>/` and GIFs from `https://media*.giphy.com/`; rules
  enforce the same prefixes on write.
- CSP is built in `csp.ts` and set per request by `src/proxy.ts` with a fresh nonce (script-src has no
  `'unsafe-inline'`; Next's inline bootstrap scripts and the theme script carry the nonce). Reading the
  nonce in the root layout makes every page dynamically rendered: the accepted cost of a strict policy.
  The service worker has its own CSP (`buildWorkerCsp`, header on `/serwist/*`); every host it fetches for
  a runtime cache must be in connect-src. `CSP_REPORT_ONLY=1` switches both to report-only.
  `pnpm test:e2e` fails on any violation in the page or the worker. Other headers in `next.config.ts`: nosniff, DENY framing, strict referrer, Permissions-Policy allowing only
  microphone(self) and media playback. The worker caches images (Cloudinary 30 d/500, OSM tiles, GIPHY,
  ytimg 7 d) CacheFirst and never caches Firebase, Google APIs or `/api/*`.
- Rules validate shapes and sizes (message text ≤ 2000, captions ≤ 500, notes ≤ 1000, no unknown
  top-level fields on users/messages, `createdAt == request.time` on creates, immutable identity
  fields; RTDB validates strokes, cursors, presence page length and canvas sizes).
- Rules are covered by emulator tests (`pnpm test:rules`). The service worker only opens
  same-origin URLs from notification clicks.

## Documentation (keep in sync — this is a hard rule)
The codebase is documented in `docs/` and `CHANGELOG.md`; this file is the spec, those describe
the code as it is. Start at [`docs/README.md`](docs/README.md):
- [architecture](docs/architecture.md) · [data model](docs/data-model.md) · [features → code](docs/features.md)
- [API routes](docs/api.md) · [security](docs/security.md) · [operations](docs/operations.md)
- [conventions](docs/conventions.md) · [adding a feature](docs/adding-a-feature.md) · [testing](docs/testing.md)
  · [troubleshooting](docs/troubleshooting.md) · [CHANGELOG](CHANGELOG.md)

Every change that adds, removes or alters behaviour, data, rules, an API route, an env var, a
script or a convention MUST, in the same commit: update the relevant `docs/*.md` page(s), add a
line to `CHANGELOG.md` under today's date, and update this spec if the product or rules changed.
A fix that only touches internals still gets a changelog line. The GitHub `README.md` is the
setup guide; update it when setup steps or scripts change. The phase summary printed at the end
of a task must say which docs were updated.

## Engineering rules
- Keep Firestore reads low: every listener is bounded (`limit`), Home subscribes to at most
  `pair/main`, `users/{friend}`, today's `checkins`, today's `moods`, today's `dailyQuestions`
  and the latest message. Use RTDB for anything updated more than a few times a minute.
- All timestamps are `serverTimestamp()`; never trust client clocks for ordering.
- `src/lib/firebase/client.ts` (browser, singletons) and `src/lib/firebase/admin.ts` (server,
  from `FIREBASE_SERVICE_ACCOUNT` base64 JSON). Never import admin in client code.
- Thin pages, logic in `src/lib/**` and hooks in `src/hooks/**`. Static decks in `src/content`.
- Every API route validates input with zod and verifies the Firebase ID token.
- TypeScript is `strict` + `noUncheckedIndexedAccess`; ESLint errors on `any`, missing hook deps and import
  order; `pnpm knip` must report nothing. Fire-and-forget promises use `.catch(swallow)` and user-facing
  errors go through `errorMessage()` (`src/lib/swallow.ts`). Pure logic lives in `src/lib` so `pnpm test`
  (vitest unit tests in `tests/unit`) can cover it; `pnpm profile:chat` measures the chat list.
- `pnpm typecheck` and `pnpm lint` must pass before each commit. One commit per phase, and
  `git push` after every commit — the remote is the backup.
- Rules deploy via Firebase CLI: `pnpm rules:deploy` → `firebase deploy --only firestore:rules,database`.
- Accessibility basics: buttons have labels, tap targets ≥ 44 px, colour is never the only signal.
- Anything read back from storage that names a game goes through `gameInfo()` in
  `src/lib/games/catalog.ts` (never index a catalogue directly; stored rows may hold types this build
  doesn't know). Widgets fed by stored lists sit inside `ui/ErrorBoundary` so one bad row can't take
  down the whole tab.
- Docs travel with code: no commit without the matching `docs/*` + `CHANGELOG.md` update (see Documentation).

## Env (`.env.example` must list all; `.env.local` is gitignored)
```
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_DATABASE_URL=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=
FIREBASE_SERVICE_ACCOUNT=            # base64 of the service-account JSON
ALLOWED_EMAILS=                      # two emails, comma-separated
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_PRESET_IMAGE=tincan_image
NEXT_PUBLIC_CLOUDINARY_PRESET_AUDIO=tincan_audio
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
TICK_SECRET=
NEXT_PUBLIC_GIPHY_API_KEY=           # optional
```

## Build order (one Claude Code prompt per phase; stop at the end of each) — all 13 phases shipped
1. ✅ **Scaffold** — Next.js app, deps, `.env.example`, folder skeleton, Firebase client/admin
   init, Google sign-in page, allowlist gate, app shell with bottom tabs and placeholder pages,
   PWA manifest + icons + service worker shell, theme tokens and fonts.
2. ✅ **Identity & rules** — onboarding (nickname, city → Open-Meteo geocode → lat/lng/tz),
   `users` + `pair/main` creation, More tab (profile, theme, friends-since, next meetup, sign out),
   `firestore.rules`, `database.rules.json`, `firebase.json`, `pnpm rules:deploy`.
3. ✅ **Presence & Home v1** — presence/heartbeat/onDisconnect, two clocks, distance, weather,
   pings with animation + vibrate, lamp, sleep/wake, mood check-in, check-ins + streak + plant.
4. ✅ **Chat v1** — text messages, pagination, ticks, typing, reactions, reply, edit/delete,
   day separators, unread badge, offline queue.
5. ✅ **Chat v2 + push** — images and voice via Cloudinary, stickers, optional GIFs,
   `/api/media` delete, FCM setup (background handler in the Serwist worker, token registration),
   `/api/push`, notification toggles, foreground toasts.
6. ✅ **Daily & letters** — daily question, journal, time capsules, open-when envelopes, jar,
   scheduled messages, `/api/tick` with all jobs, `pnpm tick:dry`.
7. ✅ **Memories** — photo timeline, memory map (Leaflet/OSM), milestones, mood history.
8. ✅ **Plan** — countdown, call-time finder, four lists, trips.
9. ✅ **Play v1** — game lobby/invites, tic-tac-toe, connect four, chess, checkers, your-turn
   push, results + head-to-head record, rematch.
10. ✅ **Play v2** — deck games (WYR, NHIE, truth/dare, conversation cards), 20 Questions,
    hangout wheel, trivia duel (live + async), know-me quiz, daily word.
11. ✅ **Together** — whiteboard + shared cursors + snapshot, pixel art, pictionary,
    watch together, listen together + queue, radio, focus timer, cook-along.
12. ✅ **Nurture** — pet (species, sprites, feed/play, levels, system messages, hungry push),
    plant SVG stages and wilt, garden stickers + unlock triggers.
13. ✅ **Polish & ship** — animations/sounds/confetti pass, empty states, usage meter, Firestore
    read audit on every screen, Lighthouse PWA pass, Vercel deploy, env on Vercel, rules
    re-review, cron-job.org for `/api/tick`, README with the manual setup checklist.

Each phase ends with: typecheck + lint green, a commit named after the phase, and a printed
summary of what was built, what was skipped, and anything the owner must do manually.
