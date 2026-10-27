# Features → code

Pages under `src/app/(app)/**` are thin: they render one screen component. Logic lives in `src/lib/db/*` (Firestore/RTDB access), `src/lib/*` (pure helpers) and `src/hooks/*`.

## Home (`/`) — `components/home/HomeScreen.tsx`, data from `hooks/useHomeData.ts`

| Card | Component | Data |
| --- | --- | --- |
| Presence (avatar, online/last seen, awake/asleep, local time, weather, distance) | `PresenceCard` | `useLiveEvents().friendPresence`, `hooks/useWeather` (Open-Meteo), `lib/geo` |
| Pings (4 bouncy buttons + full-screen overlay) | `PingRow`, `PingOverlay` | RTDB `pings/{friend}` push; `hooks/useIncomingPings`; `pair.counters.pings` → `pings-100` sticker |
| Lamp (tap → friend's lamp glows 10 min; long-press colour) | `Lamps` | RTDB `lamp/{uid}`, `lib/rtdb.lightLamp` |
| Mood check-in | `MoodCheckin` | `moods/{dateKey}_{uid}` (own tz) |
| Daily question | `DailyQuestionCard` | `dailyQuestions/{dateKey}` (room tz), `lib/daily.questionFor` |
| Streak + plant | `StreakPlant` | `checkins/{dateKey}`, `pair.streak`, `pair.plant`; `content/plant` |
| Pet widget | `PetWidget` → `/pet` | `pair.pet`, `lib/pet` (hunger derived from timestamps) |
| Countdown | `CountdownCard` | `pair.nextMeetup` or nearest `pair.tripsSummary`; `lib/meetup.resolveCountdown` |
| Next up (milestone) | `NextUpCard` | `pair.milestonesSummary`, `lib/milestones` |
| Open games / invites | `GameInvitesCard` | `useLiveEvents().openGames` |
| Latest message | `LastMessageCard` | `useChatMeta().latest` |
| Sleep/wake toggle | `SleepToggle` | RTDB presence status + system message |
| Push nudge (turn on notifications) | `PushNudgeCard` | `users/{me}.notif.enabled` |
| Waiting for friend | `WaitingCard` | shown while `pair.uids.length < 2` |

## Chat (`/chat`) — `components/chat/ChatScreen.tsx`

- `hooks/useMessages.ts`: latest 50 live, `load older` pages of 50 (auto up to 3 pages by scroll, then a button; oldest pages dropped when back at bottom), optimistic sends, delivered/read marking.
- `MessageList` (day separators, unread divider, jump-to-latest FAB), `MessageBubble` (swipe-right reply, long-press menu, reactions), `MessageMenu` (react/reply/copy/edit ≤15 min/delete for me/everyone/schedule), `Composer` (text, attachments, hold-to-record voice with slide-to-cancel, GIF/sticker panel), `ScheduleSheet` (scheduled messages), `Ticks`.
- Media: `media/*` (AttachmentStrip, UploadBubble + ProgressRing, ImageViewer with pinch-zoom, VoicePlayer 1×/1.5×, MediaPanel for GIF/stickers). Upload pipeline in `hooks/useUploads.ts` → `lib/media/compress.ts` (≤1080 px, ~0.3 MB) / `lib/media/recorder.ts` (opus 32 kbps, ≤2 min) → `POST /api/media/sign` → Cloudinary (authenticated) → `POST /api/media/urls` → signed `variants` stored on the message. Rendering goes through `lib/mediaUrl.ts` (`variantUrl`) and `ui/CloudImage`. GIFs come from `GET /api/gif` (`lib/giphy.ts`).
- Typing: `hooks/useTyping.ts` (RTDB `typing/{uid}`, 1.5 s throttle, 3 s expiry). Unread badge: `hooks/useChatMeta.tsx`.
- Rendered URLs are filtered by `lib/safeUrl.ts`; links auto-linked by `lib/linkify.tsx`.
- **Backgrounds**: `ChatBackground` is one absolute layer behind the scroller (`backdrop` prop of `MessageList`); `ChatBackgroundPicker` (palette button in `ChatHeader`, and More → Chat background) writes `users/{me}.chatBg`. Built-ins live in `content/chat-backgrounds.ts`; the photo option reads one bounded page of `memories`.
- **System lines**: every writer goes through `lib/chat/system.createSystemMessage(kind, text, meta?)` (server: `postSystemMessageAdmin(senderId, kind, text, meta?)`), sharing `systemMessageData` in `lib/chat/systemKinds.ts`: `{ type: "system", kind, text, meta?, senderId, status: "sent", createdAt }`. Kinds: sleep, wake, relationship, game-result, game-cancel, twenty-result, pet-adopt, pet-fed, pet-level, pet-hungry, garden-sticker, capsule-unlock, hangout (legacy: the removed hangout wheel wrote it; kept so old lines render), invite (rendered by `InvitePill`, see Invites under Play). `SystemPill` shows the text, else a line derived from kind + meta, else ✨, so a row is never empty; old lines render unchanged. System lines never count as unread (badge, divider), never get read/delivered writes and never show ticks; the Home preview and toasts use the same `systemLine()`. The scroller is `relative` so the absolute background layer can't paint over in-flow rows (the phase 18 blank-gap bug).
- **Rendering cost**: `MessageBubble` is `React.memo` with stable callbacks; presence lives in `PresenceProvider` and typing in `useFriendTyping` inside the header, so the list never re-renders for them. `pnpm profile:chat` measures it.

## Play (`/play`) — `components/play/PlayScreen.tsx`

**Game catalogue** (`lib/games/catalog.ts`): names, emoji, routes and result wording for every game that writes `gameResults` (the four board games, trivia, pictionary), with `gameInfo()` falling back to a neutral entry for unknown types. Used by Recent games (`RecentGamesList`, inside an `ErrorBoundary`), the record strip (now six games), Home's game card, invites, result toasts and the system messages.

**Board games** (`/play/[gameId]`, `GameScreen`, `boards/*`): engines in `lib/games/*` implement `Engine<S, M>` (`initial`, `apply`, `status`, serialise). Live state in RTDB `games/{id}` (JSON string, transactions) via `lib/db/games.ts`; results to `gameResults` and `pair.records`; `yourTurn`/`invite` pushes; `CloseGameMenu` (cancel invite / cancel 0-move game / resign); `FriendHereBadge`.

**Deck games** (`/play/deck/[deck]`, `DeckScreen`): WYR, NHIE, truth/dare, conversation cards. Shared card in RTDB `cards/{deck}`; decks from `src/content/*.json` via `lib/decks.ts`; metadata in `lib/deckMeta.ts`.

| Screen | Route | Component | State |
| --- | --- | --- | --- |
| 20 Questions | `/play/twenty` | `TwentyScreen` | RTDB `twenty/main`, `lib/db/twenty` |
| Trivia duel | `/play/trivia`, `/play/trivia/[id]` | `TriviaScreen` | Firestore `trivia/{id}` + RTDB `trivia/{id}` live session; `lib/trivia`, `lib/seeded`. Live (phase 21): `LivePlay` calls `openLiveSession` on mount, which writes `joined/{me}` on its first snapshot and, once both players are joined, starts the round in a server-only transaction (`applyLocally: false`, so a losing optimistic start can't leave a phone's view stale) with a 3 s "Get ready" countdown (`LIVE_COUNTDOWN_MS`); phases connecting → waiting → playing, or error on a refused read/write or when the node is removed. After 10 s without a question (`LIVE_GIVE_UP_MS`), or at once on error, "Couldn't connect — play async instead" calls `switchToAsync` (Firestore `mode: "async"`, live node removed). Each bank question has an `explanation`; `Question` shows the right option (green) and the line after a pick or timeout, async waits `REVEAL_MS` before the next question and live delays `advanceLive` by the same; `Results` repeats it under each answer |
| Know-me quiz | `/play/quiz`, `/play/quiz/[id]` | `QuizScreen` | `quizzes/{id}` |
| Daily word | `/play/word` | `WordleScreen`, `WordleGrid`, `WordleHistory` | `wordle/{dateKey}_{uid}`, `lib/wordle`; results via `lib/wordleResults` (pure: `wordleDayWinner`, `iRecordWordle`, `groupWordleDays`, `windowStats`) and `lib/db/wordle` (`settleWordleDay`, `loadWordleHistory`). Once both grids are in, the phone that finished last (`iRecordWordle`: later server `at`, lower uid on a tie) writes `gameResults/word-{dateKey}` in a transaction that is a no-op if the row exists, bumps `pair.records.word` and posts a `game-result` line ("🟩 Sam won the daily word in 3"); the first settle ever folds earlier both-finished days in from one bounded read (no chat lines for those). `WordleHistory` shows the all-time scoreboard from `recordFor(pair, "word")` and, on tap, the last 30 days (one `getDocs` ordered by document id, newest first, 60 docs max, past days only; today joins the list only once both finished): per day the word, each player's guess count (✗ out of guesses, … unfinished, – didn't play), 🏆 on the winner, average guesses / solved over the window, and tap-to-expand compact grids. "word" is in `GAME_CATALOG` and `RECORD_GAMES`, so the Play record strip and Recent games include it ("N guesses"). After finishing, "What does it mean?" (`Meaning`) calls `lib/wordDefinitions.fetchDefinition`, which loads `/words/{letter}.json` once per session (static files from `pnpm words:definitions`, cached by the worker's same-origin JSON route) and shows "WORD · pos — meaning" + example in the reveal card and the comparison |
| Whiteboard | `/play/whiteboard` | `together/WhiteboardScreen` + `SharedCanvas` | RTDB `whiteboard/*`, `cursors/*`; snapshot → Cloudinary → chat |
| Pixel art | `/play/pixel` | `together/PixelScreen` | RTDB `pixel/grid` (1024 chars) |
| Pictionary | `/play/pictionary[/id]` | `together/PictionaryScreen` | RTDB `pictionary/{id}`, `lib/db/pictionary`. The drawer's toolbar matches the whiteboard's (pen / eraser / widths, colours on a second row) plus a two-tap Clear → "Clear all" that empties `pictionary/{id}/strokes` for both (`clearStrokes`); the pending confirmation is keyed to the round so it drops on round end |
| Watch together | `/play/watch` | `together/WatchScreen`, `YouTubePlayer`, `JoinOverlay`, `hooks/useSyncedPlayer`, `together/Playlist`, `together/ChatDrawer` | RTDB `watch/main`, `roomchat/watch`; Firestore `playlists/watch`; `lib/youtube` (loader, error text), `lib/playerSync` (drift plan) |
| Listen together | `/play/listen` | `together/ListenScreen` (200 px player under the cover card), `together/Playlist`, `together/ChatDrawer` | RTDB `listen/main`, `listen/queue`, `roomchat/listen`; Firestore `playlists/listen` |
| Radio | `/play/radio` | `together/RadioScreen` ("India" and "World" sections, language chips, last-played station per user in localStorage) | RTDB `radio/main`; `content/radio.json` via `lib/radio.ts`; HLS natively where the browser supports it, else lazy `hls.js/light` (CORS-less streams: "This station only plays in the mobile app") |
| Focus timer | `/play/timer` | `together/TimerScreen` | RTDB `timer/main`; sessions → `pair.focusSessions` |
| Cook-along | `/play/cook[/id]` | `together/CookScreen` | `recipes/{id}` + RTDB `cook/{id}` |

**YouTube player rules** (watch and listen). `loadYouTubeApi()` in `lib/youtube.ts` loads `iframe_api` once per page, resolves at once when `YT.Player` exists, and wraps any existing `onYouTubeIframeAPIReady`. `YouTubePlayer` builds one player per mount, and only once its node is mounted, the API is loaded and a video id is known. Later ids are cued on the same player and unmounting destroys it. It passes `host: youtube-nocookie.com` and our `origin`. Local Play/Pause (`toggle` in `useSyncedPlayer`) calls the player inside the click handler, then writes RTDB. Remote state is applied only after this client joins: a one-time "Tap to join" overlay, a local Play/Pause, or loading the video yourself. Listen keeps the player at 200 px tall, the minimum YouTube allows, under an opaque cover, never hidden or 1 px. `onError` codes go to the Diagnostics log, and the player shows a friendly line. Codes 101 and 150 read "This video can't be embedded".

Heavy together screens are code-split through `together/lazy.tsx`.

**Invites** (phase 21). `hooks/useStartInvite` returns `startInvite(activity, route, label, extra?)` bound to me and my friend; `lib/db/invites.ts` does the work and `lib/invites.ts` holds the pure parts (activities + emoji, `inviteText`, `parseInviteMeta`, `inviteCardState`, the 2-minute per-activity cooldown, `joinRoute`). One call: (a) `createSystemMessage("invite", "🎯 Sam started a Trivia duel", { route, activity, label, expiresAt: +2 h, roundId? })`; (b) `invites/{friendUid}/{pushId}` = `{ from, activity, label, route, at }` in RTDB; (c) the `invite` push. `components/chat/InvitePill` renders the line with a Join button (→ `route?join=1`), "Expired" after `expiresAt`, or "Ended" when `fetchRoundState` (one lookup per round per session: RTDB `games/{id}` / `pictionary/{id}` status, Firestore `trivia/{id}` finished, `quizzes/{id}` taken) says the round is over; `MessageList` picks it for `kind === "invite"`. `hooks/useIncomingInvites` (mounted by `LiveEventsProvider`, which skips its own message toast for invite lines) turns each queued node into a toast with Join / Not now (`ToastProvider` gained `actions`), deletes it after showing and ignores anything older than 2 min on open. `GameScreen` and `PictionaryGame` accept an `invited` game once when `?join=1` is present; trivia auto-joins on open. `components/play/InviteButton` ("Invite", or "Invited ✓" while the cooldown runs; a tap during it toasts "Already invited") is rendered by `SubHeader invite=` in the header and, compact, by `FriendHereBadge` in place of the old Nudge. Callers: `PlayScreen` after `inviteGame`, `PictionaryLobby` after `invitePictionary`, `TriviaLobby` after `createRound`, `QuizScreen` on publish; the header button on the trivia round, board games, Pictionary, decks, 20 Questions, daily word, quizzes, whiteboard, pixel art, watch, listen, radio, focus timer and cook-along (whose "Start cooking together" is the same call).

**Playlists** (watch and listen). `hooks/usePlaylist` holds the one Firestore listener (`playlists/{room}`) and edits through `lib/db/playlists.ts` transactions over the pure `lib/playlist.ts` helpers (`addItem` with dedupe and optional index for undo, `removeItem`, `moveItem`, `isFull`; 50 max). `together/Playlist.tsx`: `StarButton` next to the current title (filled = saved; tapping it removes with a 4 s "Tap to undo" toast), `SaveChip` ("Save to playlist?" for 5 s after a new link), and the collapsible `PlaylistSection` ("Playlist (N)", closed by default, open state per room in localStorage via `lib/localPref`; the rows are `PlaylistRows`, loaded on open): 64 px lazy thumbnails, two-line titles, who-added avatar, now-playing highlight, drag handle (`Reorder`), swipe-left or ⋮ to remove. Watch rows load through the same gesture-safe path as a pasted link. Listen rows play now (`loadVideo(..., playing = true)`, applied by the joined player's sync), "+ Queue" adds one to `listen/queue`, and "Queue all" appends every unqueued item in one multi-path write (`enqueueMany`). The 51st save toasts "Playlist is full — remove one first".

**Room chat** (watch and listen). `together/ChatDrawer` is a side chat at RTDB `roomchat/{room}`, not the main chat: no push, no Chat-tab badge. `hooks/useRoomChat` keeps one `orderByKey().limitToLast(60)` listener while the screen is mounted (so the unread dot works with the drawer closed) and shows the newest 50; after each successful send the sender deletes anything older in one multi-path update (`lib/roomChat.trimPatch`). The drawer opens at 55dvh over the video and expands to 92dvh by dragging or tapping the grabber (`Sheet`'s `expandedHeight`). Bubbles use the main-chat styles without ticks, reactions, replies, edits or media, with avatars and times; the composer is text/emoji only (1–500 chars) and shares `lib/composerKeys.ts` (desktop Enter sends, touch Enter is a newline) with the main composer. Long-press or right-click a message for Copy / Share to main chat (posts "📺 …" or "🎧 …" as a normal message and pushes it). ⋮ → Clear chat (with confirm) removes the room node. The red dot compares the friend's newest `at` with a per-room last-seen time in localStorage.

## Memories (`/memories`) — `components/memories/MemoriesHub.tsx`

| Sub-screen | Route | Component | Data |
| --- | --- | --- | --- |
| Photo timeline | `/memories/photos` | `PhotosScreen`, `PhotoGrid`, `PhotoPicker` | `memories` 40/page by takenAt |
| Memory map | `/memories/map` | `MapScreen` → lazy `map/MemoryMap` (Leaflet/OSM) | `places` (been/want) + linked memories |
| Milestones | `/memories/milestones` | `MilestonesScreen` | `milestones` → mirrored `pair.milestonesSummary` |
| Journal | `/memories/journal` | `JournalScreen` | `journal` 20/page |
| Jar | `/memories/jar` | `JarScreen` | `jar` |
| Time capsules | `/memories/capsules` | `CapsulesScreen` | `capsules` + `private/body` |
| Open-when envelopes | `/memories/envelopes` | `EnvelopesScreen` | `envelopes` + `private/body` |
| Mood history | `/memories/moods` | `MoodsScreen` | `moods` ≤70/month |
| Daily question history | `/memories/questions` | `QuestionsHistory` | `dailyQuestions` 30/page |
| Garden | `/memories/garden` | `GardenScreen` | `pair.garden.stickers`, `content/garden` |

## Plan (`/plan`) — `components/plan/PlanScreen.tsx`

`CountdownHero` (+ `Confetti` on the day), `CallsScreen` (`/plan/calls`: `availability/{uid}` weekly 30-min slots, overlap in both tz, "Propose" posts a chat message; `lib/availability`), `ListScreen` (`/plan/lists/[kind]`: bucket · wishlist · gifts (author-private) · todo; drag reorder), `TripsScreen` (`/plan/trips`: day/stop planner → `pair.tripsSummary`).

## More (`/more`) — `components/more/MoreScreen.tsx`

`ProfileCard` (nickname, city via `onboarding/CityPicker` → Open-Meteo geocode, avatar upload, bio), `PairCard` (friends-since, next meetup, relationship preset from `content/relationships.ts`, pet name, room tz), `ThemeSwitch` (`hooks/useTheme`), `ChatBackgroundCard`, `NotificationsCard` (master switch + per-type toggles, test push), `SoundsCard` (`lib/sounds`), `UsageCard` (metered Firestore reads/writes vs Spark quota), `DiagnosticsCard` (owner only: build, worker, auth, RTDB, Firestore online/offline, Firestore reconnects this session from `lib/firestoreHealth.ts` (fed by `PairProvider`'s `pair/main` listener), CSP, network, last 20 errors from `lib/diagLog.ts`, Copy diagnostics), sign out. `shell/UpdateWatcher` checks for new deploys on launch and resume.

## Pet (`/pet`) — `components/pet/PetScreen.tsx`

`AdoptCard` picks a species on first open; `content/pets` draws the sprite by species/level/mood as inline SVG built from named parts (`breath` › `body`, `eyes` › `eyeL`/`eyeR`, `mouth`, `cheeks`, `accessory`), each an `m.g` driven by its own animation controls. Hunger and happiness are derived from `pair.pet.hungerAt/happyAt` (`100 − minutes/14.4`, see `lib/pet.ts`); Feed/Play reset the timestamps and post system messages. Level = streak ÷ 7. Hunger push comes from the tick.

**Pet life (motion only).** `hooks/usePetLife.ts` owns everything animated for one mounted stage (`usePetLife` wires the app's writes, pair, toasts and pings into the injectable core `usePetMotion(opts, env)`, which the e2e harness drives with fakes); `components/pet/PetStage.tsx` renders it (HTML actor for whole-body moves around the part-animated SVG, the food prop, looping zzz, the sad 🌧️ cloud, particles) plus `PetDim` (card veil while asleep) and `LevelBadge`. `PetScreen` (180 px) and Home's `PetWidget` (88 px, `compact`: same motion, no particles) both use it. Pure helpers in `lib/petLife.ts` (unit-tested):
- Tap: one of 10 reactions (< 700 ms each), random with no immediate repeat (`pickReaction`). 3 taps within 2 s (`tapBurst`) → 3 s "excited" with a sparkle burst. Particles are capped at 20 alive (`capParticles`). Taps while asleep only make it stir.
- Long-press (400 ms): wiggle loop + a trickle of hearts; the Joy bar tops up at 20 points/s up to 100 (`heldHappiness`, one Play's worth) and is written **once on release** as `happyAt = sinceFor(value)` (`lib/pet.ts`, inverse of `statFrom`) via `db/pet.pettedPet`.
- Feed ≈ 2 s: cookie floats in, lean, three chomps with crumbs, the write lands after the chomps so the Food bar (`PetBits.StatBar`, scaleX tween) glides to full over 800 ms, then a satisfied wiggle + heart. Sleep ≈ 1.5 s (yawn, droop, settle → zzz, card dims) and wake ≈ 1.5 s (stretch, blink open, shake, sparkle, card brightens) write `sleepAt` **at the end**. Buttons are disabled while a sequence runs; a sequence cut short (another one, or leaving the page) still writes.
- Level-up: spin, confetti (full size), accessory pops on, badge counts up.
- Idle (paused while the tab is hidden): breathing, blink every 3–6 s, glances, a fidget every 15–30 s; hungry = tummy rumble + glance at Feed, sad = slow droop + cloud, happy = soft bob, asleep = slow breathing.
- The friend's actions: `db/pet` records each value this device writes; `petEvents(prev, next, consumeMyPetWrite)` turns the other changes into feed/play/sleep/wake, replayed here (stats held at their old values until the matching beat) with a toast such as "Sam fed Blob 🍪" (key `message`, so the "fed" system message toast collapses into it). A received hug ping → heart hop (on Home after the full-screen overlay).
- Chirps `petTap`/`petFeed`/`petSleep`/`petWake` in `lib/sounds.ts`, under the Sounds toggle.
- Reduced motion: `useReducedMotion()` + `<MotionConfig reducedMotion="user">`; no idle loops, reactions or particles, and actions write immediately.

## Garden stickers — `lib/garden.recordTogetherEvent(kind, by)`

One sticker per `GardenEvent`, unlocked once, stored under `pair.garden.stickers.{kind}`; `LiveEventsProvider` toasts new unlocks. Triggers today:

| Event | Fired from |
| --- | --- |
| whiteboard, pixel, pictionary, watch, listen, focus, cook | the matching together screen on first completion |
| chess-win, c4-win, trivia | `lib/db/games.ts` on result save |
| pictionary-win, quiz, word | Pictionary / Quiz / Wordle screens |
| capsule, envelope, map-pin, trip, photos-10 | Memories & Plan screens on create |
| messages-100, voice, pings-100 | ChatScreen, `useUploads`, PingRow |
| streak-7, streak-30 | `hooks/useHomeData.ts` |
| pet-level-2 | `lib/db/pet.ts` |

## How-to sheets

`src/content/howto.ts` (`HOWTO`, keyed by `HowToKey`) is the only source of help text and of Play tile sub-labels. Pass `help="<key>"` to `SubHeader` and the screen gets a ? button; the sheet auto-opens once per device (`hooks/useHowToSeen.ts`, localStorage `tincan-howto-seen`). Cards use `<HowToButton topic autoOpen={false}>`. More → `TipsCard` resets the seen set.

## Cross-cutting

- **Auth & onboarding**: `components/auth/*` (SignInScreen, AuthGate, SetupScreen, TakenScreen), `components/onboarding/OnboardingScreen`, `components/pair/PairFullScreen`. `lib/auth.ts`, `lib/allowlist.ts`.
- **Shell**: `components/shell/AppShell`, `TabBar` (pending spinner on tapped tab), `OfflineBanner`; `lib/tabs.ts`.
- **Toasts**: `components/toast/ToastProvider` (optional `actions` buttons, used by invites). **Live events**: `components/live/LiveEventsProvider` (pings, lamp, messages, daily answer, open games, garden, invites). **Push**: `components/push/PushController`, `lib/push.ts` (token), `lib/notify.ts` (client → `/api/push`).
- **Reported Firebase access**: `lib/firebase/fs.ts` (Firestore, metered) and `lib/firebase/rt.ts` (RTDB) are the only places that import the SDKs (ESLint `no-restricted-imports`). Every rejected write and every denied read or listener is logged to `lib/diagLog` as `[write] op path → code` / `[read] …` (More → Diagnostics), and `components/dev/WriteFailureToasts` (development only, mounted by `AuthGate`) toasts permission-denied so a missing rule shows up on the first tap.
- **UI kit**: `components/ui/*` (Avatar, Button, Card, CloudImage, Input, Portal, Sheet, Skeleton, Spinner, Splash, Switch, TabError). `CloudImage` is the only way to render a Cloudinary photo (srcset, blur-up, lazy); `next/image` is not used anywhere.
- **Web vitals**: `providers/WebVitals` logs CLS/LCP/INP to the console in development only.
- **Service worker**: `src/app/sw.ts` (precache, `/offline` fallback, runtime caches for Cloudinary/OSM/GIPHY/ytimg images, NetworkOnly for Firebase/Google/`/api`, FCM background handler, same-origin notification click).
