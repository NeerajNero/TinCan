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
  registration explicitly. Updates: the worker never skips waiting on its own; `lib/swUpdate.ts`
  checks on launch / resume (hourly) and on More → "Check for updates", offers a persistent
  "Update available · Reload" toast whenever a worker is waiting (including one already waiting at
  launch), and Reload posts SKIP_WAITING + reloads once on `controllerchange`. Both users are on Android; iOS quirks can be ignored.
  Share target: the manifest's `share_target` posts title/text/url/images (`image/*`) to `/share`; the worker
  stashes the form data in the Cache API under a nonce (`lib/share.ts` keys) and 303-redirects to `/share?id=…`,
  which (behind the auth gate; a signed-out share returns via `/signin?next=`) previews it and offers destinations:
  a YouTube link → Play in Watch / Listen, Save to Watch / Listen playlist, Send to chat; any other link or text →
  Send to chat with an editable message; images → Send to chat (compress + signed upload, one message each, caption
  on the first) or Save to Memories. A direct visit shows a short explainer. Shortcuts: Chat (`/chat`), Ping
  (`/?ping=1`: Home scrolls the ping row in and glows it), Daily word (`/play/word`), Pet (`/pet`), with 96 px
  maskable icons from `pnpm icons`. Android picks up new shortcuts and the share target on (re)install.
- Firebase, Spark (free) plan only:
  - Auth — Google provider. Only emails in `ALLOWED_EMAILS` may use the app; enforce in
    security rules AND in the client gate.
  - Firestore — everything persistent (chat, journal, lists, memories, results).
  - Realtime Database (RTDB) — everything ephemeral/high-frequency (presence, typing, pings,
    lamp, cursors, live game boards, canvases, watch/listen sync, timers).
  - Cloud Messaging (FCM) — web push, VAPID key, sent from Next API routes via `firebase-admin`.
  - NEVER use Cloud Functions, Firebase Storage, Extensions, or anything requiring Blaze.
- Cloudinary (free): all photos and voice notes, **private**: signed uploads with delivery type
  `authenticated`, so only signed URLs (minted server-side, stored on the doc) can load an asset.
  API secret only in server routes. No Firebase Storage.
- Vercel Hobby. Next API routes host the server bits. `vercel.json` pins the one Hobby function region to
  Singapore (`"regions": ["sin1"]`). NEVER add `crons` to vercel.json
  (Hobby cron is daily-only); scheduling is `GET /api/tick` pinged every 15 min by cron-job.org.
- Free third-party data with no keys: Open-Meteo (weather + geocoding), OpenStreetMap tiles via
  Leaflet (memory map), YouTube IFrame Player (watch/listen together), public radio stream URLs.
  GIPHY is optional and server-side (`GIPHY_API_KEY`, proxied by `GET /api/gif`); the GIF tab hides
  when the server reports no key.
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
- Streak + plant: consecutive days both opened the app; plant SVG stage grows with it. 🛡️ shields
  (0–3) by the flame: one earned every 7 days, one covers a single missed day (toast when used).
- On this day: what you did exactly a year and a month ago (photos ≤ 3, the question, a journal
  entry, both moods), fetched once per room day and cached in localStorage; hidden when empty; taps
  open in place (viewer / sheet).
- Milestone mode / festival effects: on a milestone day or the friendiversary a themed banner, and once
  a day (localStorage) the milestone's `effect` plays (diyas | colours | snow | fireworks | kites | flowers |
  confetti, default confetti; ≤ 20 particles, transforms/opacity only, reduced motion → one calm fade);
  the pet wears the matching accessory (diya, colour smudges, Santa hat, else a party hat) on Home and
  /pet; the daily question card gets a 🎉 prefix. All from the mirrored summary, no reads.
- Pet widget: shared pet sprite + hunger/happiness bars + Feed/Play buttons.
- Countdown: days until next meetup (from `pair/main.nextMeetup`).
- Sleep/wake toggle: "Good night" / "Good morning" — sets status and posts a system message.

**Chat** — WhatsApp-like, single conversation (spec in its own section below).

**Play** — one landing, top to bottom
- "🎲 Surprise us" chip: opens a random game or activity (every screen has its Invite button).
- "Jump back in": invites for me, then active games with my turn first (hidden when empty).
- "Recent" (up to 4 of `pair.play.recent`) and "Favourites" (`pair.play.favourites`, ≤ 6; long-press any
  tile → "Pin to favourites" / "Unpin", shared by both), each hidden when empty.
- Three collapsible sections, each a sideways row of compact tiles (emoji + short label, 3.5 visible) with
  "See all" → the full two-column grid; the state is remembered per section on the device, all collapsed
  by default once Recent has entries, expanded on a fresh install:
  - Board games: Tic-tac-toe, Connect Four, Chess, Checkers, Dots and Boxes, Hangman, Battleship.
  - Quick play: Daily word, Trivia duel, Know-me quiz, 20 Questions, Would You Rather, Never Have I Ever,
    Truth or Dare, Conversation cards. (The hangout wheel was removed in phase 22.)
  - Together: Whiteboard, Pixel art, Pictionary, Watch together, Listen together, Radio, Focus timer, Cook-along.
- Status badges (Your turn, Invited, Invite sent, New quiz, Today's word ✓, "<friend> is here") render on tiles
  in every row. Then "Just finished" (rematch) and the Record strip. Opening any game or together screen
  prepends it to `pair.play.recent` (max 8, de-duplicated, one write per game per 10 minutes).

**Memories** — Photo timeline, Memory map, Milestones, Journal, Jar, Time capsules,
Open-when envelopes, Mood history (calendar for both).

**Plan** — Meetup countdown, Call-time finder, Lists (bucket, wishlist, gift ideas, to-do), Trips.

**More** — Profile (nickname, city, avatar), Theme, Notification toggles, Friends-since date,
Next meetup, Pet name, Usage meter (today's Firestore read/write estimate), App build + "Check for updates",
Diagnostics (incl. "Last tab switch: 420 ms (cold: no)", tap → content paint, last ten in the copy dump), Sign out.

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
- The chat wallpaper is shared (`pair/main.chatBg`, `chatBgBy` = who set it; the picker says "Shared with
  <friend>", the other phone gets a small toast, no chat line, no push; the legacy `users/{uid}.chatBg` is
  copied once by the first opener and then deleted): eight CSS-only built-ins in
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
  (`chatBg` is legacy: readable, deletable, never written)
`pair/main`: uids[2], roomTz, friendsSince, nextMeetup{date,label,place}, relationship (preset id,
  default "friends"; see `src/content/relationships.ts`), theme,
  pet{name,species,hungerAt,happyAt,sleepAt,level,bornAt}, plant{stage,lastGrowthDate},
  garden{stickers[]}, streak{count,lastDateKey,best,monthBest,shields,shieldUsedOn}, chatBg, chatBgBy,
  play{recent[{id,at (client ms),by}] ≤ 8, favourites[id] ≤ 6} (Play tab usage; ids are `lib/play/catalog.ts` ids)
`messages/{id}`: senderId, type(text|image|voice|gif|sticker|system), text,
  media{url,publicId,variants{w320,w640,w800,blur,original|audio},w,h,durationMs,bytes},
  replyTo{id,preview,senderId,type},
  reactions{uid:emoji}, status(sent|delivered|read), deliveredAt, readAt, editedAt,
  deletedFor[], deletedForEveryone, createdAt, kind?, meta?  (kind/meta: system lines only)
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
`milestones/{id}`: title, date, repeatYearly, emoji, effect? (festival effect id)
`lists/{kind}/items/{id}` (kind: bucket|wishlist|gifts|todo): text, addedBy, done, doneAt, note, url, order
  — `gifts` items are private to their author (rule-enforced: read/write only by `addedBy`)
`trips/{id}`: title, startDate, endDate, place, days[{date, stops[{time,name,note}]}]
`availability/{uid}`: slots{ "mon": [ "09:00","09:30",...] } in that user's tz
`gameResults/{id}`: game, players[], winnerId|null, score{}, startedAt, endedAt
`quizzes/{id}`: authorId, questions[{q, answer, decoys[3]}], takenBy{uid:{score,answers[],at}}
`wordle/{dateKey}_{uid}`: guesses[], solved, at
`trivia/{id}`: questionIds[10], answers{uid:[...]}, scores{}, startedAt
`recipes/{id}`: title, ingredients[], steps[], addedBy
`playlists/{room}` (room: watch|listen): items[{videoId, title, addedBy, addedAt (client ms)}] (≤ 50, unique
  by videoId), updatedAt, updatedBy — edited only in transactions; thumbnails derived, never stored
`push/{id}`: (server-only log) toUid, type, sentAt   — for de-duplication, prune to last 200
`tickLog/{jobKey}`: ranAt — idempotency for /api/tick jobs

Static content lives in `src/content/*.json`, not the DB: daily questions (365+), word list
(5-letter, ~1500 answers + larger allowed list), trivia bank (300+ questions, 4 options each),
would-you-rather (150+), never-have-I-ever (150+), truth/dare (100+ each), conversation cards
(150+), pictionary words (300+), 20-questions secret words (200+), festivals (`festivals.json`: 12 yearly
entries for 2026–2028, fixed `MM-DD` or per-year dates with `verify` flags, the import source for
Memories → Milestones → "Add festivals"),
pet species (3 SVG sprite sets × 4 moods), plant stages (10 SVGs), garden stickers (24 SVGs),
radio stations (`src/content/radio.json`: 6 World streams + 6 official All India Radio / Prasar Bharati HLS
streams, each with id, name, region, language (India), format mp3|aac|hls, URL, extra hosts, attribution).
Every trivia question also carries an `explanation`. Word definitions are static files, not bundled:
`public/words/{a..z}.json` (word → {pos, meaning ≤ 120, example?}), generated by
`scripts/build-word-definitions.mjs` from WordNet plus `src/content/word-definitions-manual.json`.

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
`gameReactions/{gameId}/{pushId}`: {by, emoji, at} — the 👏/😱/🤔/😂 row during a board game, a queue like pings: each phone
  animates a child once (by push id), ignores and deletes whatever existed when it opened, keeps ≤ 12 on screen; the sender
  deletes its child after 5 s and the tick removes the node with the game
`gamePrivate/{gameId}/{uid}`: {word, round} (Hangman setter) or {fleet: JSON of Ship[]} (Battleship) — readable and
  writable by that uid only (a separate top-level node: RTDB read rules cascade, so nothing private can live under the
  readable `games`); the tick removes it when it unlists or abandons the game
`cards/{deck}`: {index, flippedBy, at} — shared current card for deck games
`pictionary/{gameId}`: {drawerUid, word, startedAt, strokes…, guesses[], solvedAt}
`watch/main`: {videoId, playing, positionSec, updatedAt, by, title}
`listen/main`: same shape; `radio/main`: {stationId, playing, by}
`timer/main`: {mode(focus|break), endsAt, startedBy, running}
`cook/{recipeId}`: {checked{stepIdx:true}, by}
`twenty/{gameId}`: {holderUid, secret, questionsAsked, status}
`trivia/{roundId}`: {joined{uid: ms}, qIndex?, qStartedAt?, startedBy?, answered{uid: choice}} — the live duel cursor (see Trivia duel)
`invites/{uid}/{pushId}`: {from, activity, label, route, at} — a queue like pings; the receiver shows a Join / Not now toast and deletes it
`roomchat/{room}/{pushId}` (room: watch|listen): {uid, text (1–500), at} — the Watch/Listen side chat, newest 50 kept

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
- System lines are `{ type: "system", kind, text, meta?, senderId, status: "sent", createdAt }`, written only by
  `createSystemMessage(kind, text, meta?)` in `src/lib/chat/system.ts` (server: `postSystemMessageAdmin`; shared
  shape `systemMessageData` in `systemKinds.ts`). No deliveredAt/readAt: they never count as unread, never get
  receipts or ticks. `SystemPill` shows text, else a line from kind + meta, else ✨ — never an empty row.
  Kinds: sleep, wake, relationship, game-result, game-cancel, twenty-result, pet-adopt, pet-fed, pet-level,
  pet-hungry, garden-sticker, capsule-unlock, hangout (legacy, nothing writes it), invite, recap (the monthly
  numbers line, server-written). `invite` lines render as `InvitePill` (see Invites).
- Day separators ("Today", "Yesterday", date), unread divider on open, jump-to-bottom FAB,
  unread count badge on the Chat tab, last-message preview on Home.
- Images: compress in browser (max 1080 px, ~0.3 MB, JPEG/WebP) → signed upload to preset
  `tincan_image` (authenticated) → store `url`, `publicId`, `w`, `h` and the signed `variants` (see Media).
  Thumbnails render the w320/w640 variants, the viewer w800. Tap for full-screen viewer with pinch-zoom.
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
  meetup countdown (7/1 day) ✓, pictionary/trivia invite ✓, morning digest (its own switch + hour picker,
  `notif.digest = { enabled, hour }`, default off / 08:00 in the user's tz) ✓.
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
  7. Morning digest: per user at `notif.digest.hour` in their own tz (15-min window, `tickLog`
     per user per local day): your-turn games and waiting invites (RTDB open-games index), undrawn
     jar notes (≤ 10), today's question if unanswered, the pet when food or joy < 30, capsules
     unlocking today, milestones today, unread count. Nothing → no push. "☀️ Good morning, {nickname}",
     "·"-separated body, opens Home.
  8. Monthly recap on the 1st at 09:00 ROOM_TZ: last month's messages per person (2 `count()`
     queries on messages by senderId + createdAt), games won / drawn (3 on gameResults by winnerId +
     endedAt), stickers earned, longest streak (`streak.monthBest`, then reset to the current count),
     favourite ping (`counters.pingCounts` minus the snapshot on `pair.recap`) → one `recap` system
     line, no push. Both query shapes need the composite indexes in `firestore.indexes.json`.
  9. 09:00 ROOM_TZ: any milestone still marked `verify` whose next occurrence is exactly 7 days away →
     "Is this date right?" push to both (milestone toggle) deep-linking to `/memories/milestones?edit={id}`.
- Dry run: `pnpm tick:dry` prints what would be sent without sending.

## Media — Cloudinary
- Two presets, both **Signed** mode with delivery type **authenticated** (`pnpm cloudinary:presets`
  sets this): `tincan_image` (folder `tincan/images`, incoming `c_limit,w_1080,h_1080,q_auto:low`) and
  `tincan_audio` (folder `tincan/audio`, resource type video).
- Upload: `POST /api/media/sign` signs a fixed param set (timestamp, folder, preset, `type=authenticated`,
  the image transformation; 5 MB image / 3 MB audio cap) → the browser uploads straight to Cloudinary →
  `POST /api/media/urls` returns signed delivery URLs for the fixed variant set in
  `src/lib/media-variants.json` (images: w320, w640, w800, blur, original; avatars: face 256, original;
  audio: audio). The client stores them as `variants` on the message / memory / journal / capsule /
  avatar and renders **only stored URLs** (`src/lib/mediaUrl.ts`, `CloudImage`). Unsigned or tampered
  URLs return 401. Signatures don't expire; each URL opens exactly one variant of one asset.
- Changing a variant's transformation means re-signing stored URLs: re-run
  `pnpm migrate-media --yes` (it also moves any public asset under `tincan/` to authenticated).
- Server routes using `CLOUDINARY_API_SECRET`: `/api/media/sign`, `/api/media/urls`, `DELETE /api/media`
  (destroy; only the uploader may delete).
- Show an upload progress ring; retry once on failure.

## Feature specs (brief)
- **Daily question**: index = days since epoch in ROOM_TZ mod list length. Reveal friend's answer
  after mine; push when friend answers. History in Memories.
- **Streak/plant**: client writes `checkins/{dateKey}.{uid}=true` on app open. `pair.streak` =
  { count, lastDateKey, best, monthBest, shields (0–3), shieldUsedOn }: reaching a multiple of 7 earns a
  shield; a one-day gap with a shield consumes it and keeps counting (`shieldUsedOn` = the missed day,
  Home toasts "🛡️ A shield saved your streak"); any other gap restarts at 1 (shields kept). The plant's
  wilt rule treats a shielded day as not missed; the 21:00 streak-risk push mentions a shield when one
  is held. `counters.pingCounts[kind]` is bumped with every ping for the recap. Streak counts
  consecutive dateKeys with both uids. Plant stage = min(10, streak/3 + 1); a missed day wilts
  the SVG (droopy variant) but never resets the stage below 1.
- **Pet**: shared. Hunger and happiness are not stored as numbers; each is derived as
  `100 - minutes since lastAction / 14.4` clamped 0–100 (so 24 h to empty). Feed/Play set the
  timestamps. Level up every 7 streak days; sprite changes per level. Species chosen on first
  open by either user; name editable in More. Pet events post system messages.
- **Pet life** (motion only, stats logic unchanged): sprites are inline SVG with named parts
  (body, eyes, mouth, cheeks, accessory) animated separately via Framer Motion `m` on
  transforms/opacity; prefers-reduced-motion honoured. Tap → one of 10 short reactions (no
  immediate repeat); 3 taps in 2 s → 3 s excited burst; ≤ 20 particles alive. Long-press pets
  (happiness tops up, max one Play's worth, written once on release). Feed ≈ 2 s, sleep/wake
  ≈ 1.5 s sequences with buttons disabled; sleep/wake write at the end. Idle breathing/blinks/
  glances/fidgets + mood idles, paused while hidden. The friend's feed/play/sleep/wake replays
  with a toast; a hug ping → heart hop; level-up spins with confetti. Four chirps under the
  Sounds toggle. The Home widget shows the same motion smaller, without particles.
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
- **Milestones**: list + "next up" on Home; yearly repeat; push on the day; optional `effect` (chips in the
  form) for milestone mode. "Add festivals" imports `content/festivals.json` (fixed-date festivals as one
  repeat-yearly milestone, moveable ones as one one-off per seeded year, skipping past dates and anything
  already present by title + date); afterwards they are ordinary milestones. Correct a festival date by
  editing the milestone; the seed is only the import source. Milestones carry `verify?: boolean` (the
  seed's lunar dates import with it; a "Date needs checking" switch in the editor sets it): the list shows
  "⚠️ check the date" + "Looks right ✓", editing the date clears it, and the tick reminds 7 days before.
- **Call-time finder**: each sets weekly 30-min availability in their tz; overlap shown in both
  tz; "Propose" posts a chat message with the slot.
- **Lists**: four kinds, shared (gift ideas private to the author), check-off, reorder by drag, who-added avatar.
- **Trips**: simple day/stop planner; countdown on Home uses the nearest upcoming trip if
  `nextMeetup` is empty.
- **Turn-based games** (tic-tac-toe, connect four, chess via chess.js, checkers, dots and boxes, hangman,
  battleship): lobby creates a game in RTDB, friend gets "your turn" pushes, results saved to `gameResults`,
  head-to-head record shown in Play. Rematch button (keeps the board options). Each board is its own chunk.
  **Dots and Boxes**: 5×5 dots (default) or 6×6 chosen in a lobby sheet; tap the gap between two dots;
  completing a box scores it and keeps the turn; most boxes wins (equal = draw). **Hangman**: best of three,
  roles alternate (inviter sets round 1); the setter types a word or short phrase (letters and spaces, ≤ 20) or
  takes a random daily-word answer; the word is written to `gamePrivate/{id}/{setterUid}` and never to the shared
  state; the guesser's letters go to `POST /api/games/hangman/guess`, which resolves them with the admin SDK
  (mask, misses, six wrong = round lost) and reveals the word in the round when it ends; the reveal shows the
  WordNet meaning when one exists; first to two rounds wins. **Battleship**: 10×10, ships 5/4/3/3/2; placement
  (tap, Rotate, drag, Random, Ready) keeps the fleet on the phone until Ready writes it to `gamePrivate`; the
  shared state holds only readiness, shots, sunk ships (with their cells) and the turn; `POST
  /api/games/battleship/shot` checks the turn, reads the opponent's fleet with admin, writes hit/miss/sunk and the
  win; "Waiting for X to place ships" with an Invite button until both are ready; a sunk shot shows a banner.
  Server-resolved moves do the result bookkeeping (gameResults, `pair.records`, chat line, pushes) with admin.
- **Deck games** (Would You Rather, NHIE, Truth or Dare, Conversation cards): shared current
  card in RTDB; either flips; answers/votes stored on the card; running tally where it fits.
- **20 Questions**: one picks a secret (or random from list), the other asks in chat-like box
  with Yes/No/Sort-of buttons; 20-question counter; reveal.
- **Trivia duel**: 10 random questions from the bank, 15 s each, can be played live (both
  online, synced via RTDB) or async (each plays when free; results compare when both done).
  Live handshake: opening `/play/trivia/{id}` as either player auto-joins (`openLiveSession` writes
  `trivia/{id}/joined/{me}` on its first snapshot); whichever client first sees both joined starts the
  round in a server-only transaction (`qIndex: 0`, `qStartedAt: now + 3 s` countdown, idempotent). Nothing
  waits for the host. If no question has appeared 10 s after opening, or the backend refused a read/write,
  the screen offers "Couldn't connect — play async instead" (`switchToAsync`: `mode: "async"` + the live
  node removed; the other phone sees the node go and gets the same offer). Lobby "Play live" still needs the
  friend online.
  Every question carries a one-line factual `explanation` (≤ 140 chars, unit-tested); after an
  answer or timeout the right option and the explanation stay up for `REVEAL_MS` (4 s) in both
  modes before the next question, and the results list repeats it under each answer.
- **Know-me quiz**: author writes questions about themselves with the right answer + decoys;
  friend takes it; score + reveal; both directions.
- **Daily word**: same 5-letter word for both (deterministic by dateKey); independent 6-guess
  games. After finishing, "Share my grid to chat" posts a normal text message "Tincan word #N k/6"
  plus the 🟩🟨⬛ grid (one row per guess, X/6 unsolved; `#N` counts from 2026-10-17) and sends the
  message push; once per day per device. After both finish, grids are compared and a 🏆 goes to fewer guesses. The day is then
  settled once by the later finisher: `gameResults/word-{dateKey}` (create-once), `pair.records.word`
  and a "🟩 Sam won the daily word in 3" line (the first settle folds earlier days in). The screen
  shows an all-time scoreboard (days won / draws, from `pair.records.word`, also in the Play record
  strip) and a tap-to-load 30-day history (one bounded read, an ascending document-id range: word, guess counts, 🏆, averages,
  expandable grids; today appears only once both finished). Once a player has
  finished (win or lose) a "What does it mean?" link fetches `public/words/{letter}.json` (nothing
  is loaded before that) and shows "WORD · noun — meaning" with the example smaller, in the reveal
  card and in the side-by-side comparison. Definitions come from WordNet 3.1 (`wordnet-db`,
  devDependency only) via `pnpm words:definitions`, merged with `src/content/word-definitions-manual.json`
  for words WordNet lacks or defines badly; the 26 files are committed and rebuilt only when the
  answer list changes.
- **Pictionary**: drawer sees the word, draws on shared canvas (RTDB strokes), guesser types;
  60 s; 3 or 5 rounds (chosen in the lobby, default 3), drawer alternating; score. Round advance is a
  transaction keyed to the round the tapper saw (a double tap never skips a round); the round clock is
  server time. Drawer tools: pen, eraser, widths, colours and a confirmed "Clear all" that wipes the
  canvas for both.
- **Whiteboard**: pen/eraser/colours/clear, shared cursors, "snapshot" button uploads a PNG to
  Cloudinary and posts it to chat.
- **Pixel art**: 32×32 shared grid, 16-colour palette, shared cursors, snapshot to chat.
- **Watch together**: paste a YouTube URL; IFrame Player; play/pause/seek broadcast via RTDB;
  drift correction if >2 s apart; the side chat is the Watch room chat (below). One IFrame API loader
  (`src/lib/youtube.ts`); the player is built only once a video id is known and destroyed on route
  change. Local Play/Pause drives the player inside the tap, then writes RTDB; remote state applies only
  after a one-time "Tap to join". onError codes go to Diagnostics (101/150: "can't be embedded").
- **Playlists** (watch and listen): ★ by the current title saves to `playlists/{room}` (filled = saved; tap again
  removes with a 4 s Undo toast); "Save to playlist?" chip for 5 s after a new link; collapsible "Playlist (N)"
  under the player (closed by default, remembered per room on the device; rows load lazily because `Reorder`
  brings framer's layout runtime) with thumbnails, who-added avatar, now-playing, drag to reorder, swipe-left or ⋮
  to remove; 50 max ("Playlist is full — remove one first"). Watch rows load through the gesture-safe path; Listen
  rows play now, "+ Queue" / "Queue all" append to the live `listen/queue`, which stays as it was.
- **Room chat** (watch and listen): the chat drawer is a separate thread at RTDB `roomchat/{room}` (one
  `limitToLast` listener while the screen is open; sender trims beyond 50 after each send), not the main chat: no
  push, no Chat badge, a dot on the drawer button for the friend's unseen messages (last-seen in localStorage).
  Opens at 55dvh, drag up to full. Text/emoji only; long-press → Copy / Share to main chat ("📺 …" / "🎧 …");
  ⋮ → Clear chat.
- **Listen together**: same mechanism, audio-only UI (the player stays at a real 200 px size under an
  opaque thumbnail card, never display:none or 1 px),
  shared queue (RTDB list). **Radio**: curated public streams in "India" (official All India Radio channels from
  the akashvani.gov.in player: Vividh Bharati, FM Gold, FM Rainbow, Raagam, AIR Kannada, AIR Telugu — no
  commercial FM, no mirrors) and "World" sections, language chip on Indian stations, synced play/pause, tap-to-start
  fallback, attribution line, last-played station per user in localStorage. HLS plays natively where
  `canPlayType("application/vnd.apple.mpegurl")` is truthy (Android Chrome); elsewhere `hls.js/light` (pinned, ~110 KB
  gzip) is dynamically imported on the Radio route for that station only; a stream without CORS shows "This station
  only plays in the mobile app". Stream hosts (and redirect/segment hosts, listed per station as `hosts`) go to
  media-src, HLS hosts also to connect-src, exact hosts only; the service worker never intercepts them
  (`RADIO_HOSTNAMES` bypass in `sw.ts`).
- **Focus timer**: shared Pomodoro 25/5; both see the same countdown; chime at phase end.
- **Cook-along**: pick a recipe (both can add recipes); steps tick off live for both.
- **Mood history**: month calendar with both users' emoji per day.
- **Invites** (phase 21): one helper, `startInvite(activity, route, label, meta?)` from
  `hooks/useStartInvite` (binds me + friend; the lib is `lib/db/invites.ts`, pure parts in `lib/invites.ts`),
  used by every game and together activity. It (a) posts a chat card via
  `createSystemMessage("invite", "🎯 Neeraj started a Trivia duel", { route, activity, label, roundId?, expiresAt })`
  (`expiresAt` = +2 h), rendered by `InvitePill` with a Join button that navigates to `route?join=1` (board
  games and Pictionary auto-accept on arrival; trivia auto-joins anyway); the button reads "Expired" after
  `expiresAt` or "Ended" when the referenced round is finished / declined / taken (one lookup per round per
  session); (b) queues an in-app toast at RTDB `invites/{friendUid}/{pushId}` = `{ from, activity, label,
  route, at }`, shown with Join / Not now while their app is open, deleted after showing, ignored if older
  than 2 min on open (`hooks/useIncomingInvites`, mounted by `LiveEventsProvider`, which skips its usual
  message toast for `invite` lines); (c) sends the existing `invite` push. Starting a board game, a trivia
  round, a Pictionary round or publishing a quiz calls it automatically; every other activity (decks, 20
  Questions, daily word, whiteboard, pixel art, watch, listen, radio, focus timer, cook-along) has an Invite
  button in its header (`SubHeader invite=`), and the friend-here line's old Nudge is the same button.
  Rate limit: one invite per activity per 2 minutes per person (client cooldown; the button shows "Invited ✓",
  a second tap toasts "Already invited"). Labels complete the sentence "🎯 {nickname} started …".
- **How-to sheets**: every game, together activity and slow feature (pet, plant, garden, jar, capsules,
  envelopes, daily question, call-time finder) has an entry in `src/content/howto.ts`, shown by the ? in
  its header (auto-opens once per device) and used for Play tile sub-labels. No tours or tooltips.
- **Usage meter**: client counts Firestore reads/writes per session and estimates daily use vs
  the free quota; shows a friendly gauge in More. Purely informational.

## Security rules (must be written in Phase 2 and kept current)
- Firestore and RTDB: deny all by default; allow only if `request.auth.token.email` is in the
  allowlist (hard-code the two emails in the rules files; keep them in sync with `ALLOWED_EMAILS`).
- `users/{uid}`: write only by that uid. `fcmTokens` only by owner. `chatBg` is no longer an allowed field
  (a legacy value may only be deleted); the shared wallpaper is validated on `pair/main.chatBg`.
- `messages`: create only with `senderId == request.auth.uid`; `deliveredAt/readAt/status` only
  updatable by the non-sender; `text/editedAt/deletedForEveryone` only by sender; `reactions`
  and `deletedFor` by either, but a user may only set their own key.
- `capsules/{id}/private/body`: read allowed if author, or `request.time >= unlockAt`.
- `envelopes`: body readable by `forUid` only after `openedAt` is set by them, and by author always.
- `scheduled`: readable/deletable by sender only; delivery is done by the server (admin).
- `tickLog`, `push`: admin-only (no client access).
- RTDB: `presence/{uid}`, `typing/{uid}`, `cursors/{uid}`, `lamp/{uid}` writable only by `uid`;
  `pings/{uid}` and `invites/{uid}` children creatable by the other user (`from == auth.uid`, validated
  shape, `route` a same-origin path) and deletable by the owner, `invites/{uid}` readable by the owner only;
  shared nodes writable by both allowlisted users. `trivia/{id}`: `qIndex`/`qStartedAt` numbers, `startedBy`
  string, `joined/{uid}` and `answered/{uid}` numbers that are the caller's own or unchanged (transactions
  rewrite the node), nothing else.
  `roomchat/{watch|listen}/{id}`: create only as yourself, delete by either, no edits, text 1–500, at ≤ now.
  `gameReactions/{gameId}/{id}`: create only as yourself (`by == auth.uid`, `emoji` 1–8 chars, `at` number, nothing else),
  delete by either, never edited.
  `gamePrivate/{gameId}/{uid}`: read and write by `$uid` only; `word` lower-case letters and spaces 1–20, `round`
  number, `fleet` string ≤ 600, nothing else. `games.type` enumerates the seven board games.
- `messages`: `kind`/`meta` only on system lines; `kind == "invite"` requires meta keys route (same-origin path),
  activity (≤ 32), label (1–80), expiresAt (number) and optionally roundId (≤ 64), nothing else.
  `playlists/{watch|listen}`: keys items/updatedAt/updatedBy only, ≤ 50 items, updatedBy == caller.
  `pair/main.play`: a map with only `recent` (list ≤ 8) and `favourites` (list ≤ 6).

## Security (phase 15a)
- API routes share one guard (`src/lib/server/guard.ts`): ID token verified with revocation
  checking, `email_verified` + allowlist required, bodies ≤ 16 KB and zod `.strict()`, an in-memory
  token bucket per uid per route, and a Firestore daily cap per uid (`quota/{uid}_{day}`, admin-only:
  push 1000, media/sign 300, games 1500). `/api/tick` compares its secret with `timingSafeEqual`. Error bodies
  are minimal; details only in server logs. `POST /api/games/hangman/guess` and `POST /api/games/battleship/shot`
  (guard key `games`) are the only routes that move a game: they verify the caller is the player to move, read
  the opponent's `gamePrivate` subtree with admin and rewrite `games/{id}` in a transaction.
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
  `pnpm test:e2e` fails on any violation in the page or the worker, except two known third-party messages ignored
  (and logged) by `tests/e2e/violations.ts`: Google's gen_204 beacon and YouTube's compute-pressure probe. Other headers in `next.config.ts`: nosniff, DENY framing, strict referrer, Permissions-Policy (`buildPermissionsPolicy`
  in `csp.ts`) allowing microphone(self) and delegating autoplay/encrypted-media/fullscreen/picture-in-picture to the YouTube origins. The worker caches images (Cloudinary 30 d/500, OSM tiles, GIPHY,
  ytimg 7 d) CacheFirst and never caches Firebase, Google APIs or `/api/*`.
- Rules validate shapes and sizes (message text ≤ 2000, captions ≤ 500, notes ≤ 1000, no unknown
  top-level fields on users/messages, `createdAt == request.time` on creates, immutable identity
  fields; RTDB validates strokes, cursors, presence page length and canvas sizes).
- Rules are covered by emulator tests (`pnpm test:rules`). The service worker only opens
  same-origin URLs from notification clicks.

## Privacy (phase 16)
- Media is private (authenticated delivery, signed variant URLs; rules validate every stored variant
  URL). GIPHY is called only from `/api/gif` (key server-side; GIPHY sees our server, not the phone).
  YouTube uses the privacy-enhanced `youtube-nocookie.com` player.
- No `dangerouslySetInnerHTML` anywhere (the theme script is `public/theme-init.js`, kept identical to
  `src/lib/theme.ts` by a unit test). User-typed links render only if http(s), always with
  `rel="noopener noreferrer"`.
- `/api/tick` answers live runs with counts only (cron-job.org stores response bodies); details only
  with `?dry=1`. `/api/health` reports booleans and an error *name*, never a message.
- What leaves Firebase/Cloudinary, and to whom, is listed in README → Privacy & access. Keep it current.
- Backups: `pnpm export` (dated JSON + media CSV in `./exports/`, gitignored). Spark has no managed
  exports, so this is the only backup.

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
- Client code imports Firestore from `@/lib/firebase/fs` and the RTDB SDK from `@/lib/firebase/rt`, never
  `firebase/firestore` or `firebase/database` directly (ESLint `no-restricted-imports`, lifted only under
  `src/lib/firebase`, tests and scripts). Both wrappers report every rejected write (set/update/remove/
  push/transaction/onDisconnect, setDoc/updateDoc/addDoc/deleteDoc/batch/transaction) and every denied
  read or listener (get/getDoc/getDocs, onValue/onChildAdded/onSnapshot, even without a caller error
  callback) to the Diagnostics log as `[write] op path → code` / `[read] …`; in development a
  permission-denied also shows as a toast (`WriteFailureToasts`). Never attach a listener that can't fail
  visibly. `tests/unit/rules-coverage.test.ts` (part of `pnpm test`) scans those wrappers' call sites and
  fails if a Firestore collection or RTDB top-level node has no explicit block in `rules/*.tmpl`, so a
  new path needs its rule in the same commit. It also classifies every Firestore `query(...)` and fails when
  one needs a composite index that `firestore.indexes.json` lacks (printing the entry) or orders by document id
  descending (needs `__name__ DESC`; use an ascending id range). Prefer query shapes the built-in indexes serve.
  Every RTDB `orderByChild("field")` must have that field in its node's `.indexOn` in the RTDB template
  (`games` and `pictionary` index `open`); the same test fails otherwise.
- Tab navigation: the `(app)` layout mounts the providers once (no per-tab layouts, nothing refetches
  `pair/main` or user docs on navigation); `experimental.staleTimes.dynamic = 300` keeps visited tabs in the
  router cache; `TabPrefetcher` fully prefetches the six tabs on idle after sign-in; every tab has a
  `loading.tsx` skeleton (`TabLoading`); `TabBar` + `TabPaint` time each switch (`lib/tabTiming.ts`).
- Thin pages, logic in `src/lib/**` and hooks in `src/hooks/**`. Static decks in `src/content`.
- Every API route validates input with zod and verifies the Firebase ID token.
- TypeScript is `strict` + `noUncheckedIndexedAccess`; ESLint errors on `any`, missing hook deps and import
  order; `pnpm knip` must report nothing. Fire-and-forget promises use `.catch(swallow)` and user-facing
  errors go through `errorMessage()` (`src/lib/swallow.ts`). Pure logic lives in `src/lib` so `pnpm test`
  (vitest unit tests in `tests/unit`) can cover it; `pnpm profile:chat` measures the chat list.
- GitHub Actions (`.github/workflows/ci.yml`) runs typecheck, lint, knip, unit tests and the rules tests on
  every push and PR, and the build + Playwright on pushes to main; it needs no secrets (placeholder env).
- `pnpm typecheck` and `pnpm lint` must pass before each commit. One commit per phase, and
  `git push` after every commit — the remote is the backup. The full finish list (knip, tests, e2e when relevant,
  `pnpm size` for bundle budgets, docs) is in `docs/adding-a-feature.md` → Finish; `/ship` runs it.
- Rules deploy via Firebase CLI: `pnpm rules:deploy` → `firebase deploy --only firestore:rules,firestore:indexes,database`
  (`firestore.indexes.json`, referenced from `firebase.json`, travels with the rules).
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
GIPHY_API_KEY=                       # optional, server-only
CSP_REPORT_ONLY=                     # debug: 1 = report-only CSP
E2E_HARNESS=                         # tests only: 1 serves /e2e/* harness pages
```

## Build order (one Claude Code prompt per phase; stop at the end of each) — phases 1–24 shipped
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
14. ✅ **Fixes** — ping queue, game end reasons and close menu, finished-game listing, tick housekeeping.
15. ✅ **Hardening** — 15a security (guard, signed uploads, headers, rules tests), 15b performance &
    polish (chat backgrounds, bundle diet, worker caches, unit tests, strict TS/lint, knip), 15c layout
    (portalled sheets, locked document, Playwright), 15d CSP with nonce + game catalogue.
16. ✅ **Privacy & docs** — private media (authenticated + signed variants, migration script), GIPHY
    server-side, access audit, `pnpm export` backup, polish, README rewrite.
17. ✅ **Pet life** — part-based sprite animation, tap reactions, petting, feed/sleep/wake/level-up
    sequences, idle life, friend replays, chirps.
18. ✅ **Rooms & fixes** — system lines fixed (blank gaps) and normalised, Watch/Listen playlists, separate
    Watch/Listen room chat.
19. ✅ **Indian radio** — six official All India Radio HLS stations, India/World sections, native HLS or lazy hls.js.
20. ✅ **Meanings** — WordNet definitions for every daily word (static letter files, "What does it mean?" after
    finishing), a factual explanation on every trivia question with a reveal pause in both modes.
21. ✅ **Live trivia fix + invites** — reported Firebase wrappers (Diagnostics + dev toast), the missing
    `trivia/{id}` RTDB rule and a host-free live handshake with an async fallback, emulator tests for the
    stall and every live write, `startInvite` (chat Join card, RTDB toast queue, push) on every activity.
22. ✅ **Ten-day feedback** — daily word scoreboard + 30-day history (settled into `gameResults` /
    `pair.records.word`), Pictionary "Clear all", hangout wheel removed.
23. ✅ **Little delights** (commit "phase 22: little delights") — morning digest, On this day, monthly
    recap, milestone mode, share the word grid, streak shields. Two composite indexes.
24. ✅ **Shared wallpaper + festivals** (commit "phase 22b") — chat wallpaper on `pair/main` (one-time
    migration, friend toast, rules moved), milestone `effect` + seven festival effects and pet accessories,
    `festivals.json` seed with "Add festivals".
25. ✅ **Share target, shortcuts, three games** (commit "phase 23") — Android share target (`/share` via the
    worker's Cache API stash), four home-screen shortcuts, Dots and Boxes, Hangman and Battleship on the turn-based
    engine with owner-only `gamePrivate` subtrees and two server routes for the hidden-information moves.

Each phase ends with: typecheck + lint green, a commit named after the phase, and a printed
summary of what was built, what was skipped, and anything the owner must do manually.
