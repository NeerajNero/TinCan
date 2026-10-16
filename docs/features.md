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
- **Rendering cost**: `MessageBubble` is `React.memo` with stable callbacks; presence lives in `PresenceProvider` and typing in `useFriendTyping` inside the header, so the list never re-renders for them. `pnpm profile:chat` measures it.

## Play (`/play`) — `components/play/PlayScreen.tsx`

**Game catalogue** (`lib/games/catalog.ts`): names, emoji, routes and result wording for every game that writes `gameResults` (the four board games, trivia, pictionary), with `gameInfo()` falling back to a neutral entry for unknown types. Used by Recent games (`RecentGamesList`, inside an `ErrorBoundary`), the record strip (now six games), Home's game card, invites, result toasts and the system messages.

**Board games** (`/play/[gameId]`, `GameScreen`, `boards/*`): engines in `lib/games/*` implement `Engine<S, M>` (`initial`, `apply`, `status`, serialise). Live state in RTDB `games/{id}` (JSON string, transactions) via `lib/db/games.ts`; results to `gameResults` and `pair.records`; `yourTurn`/`invite` pushes; `CloseGameMenu` (cancel invite / cancel 0-move game / resign); `FriendHereBadge`.

**Deck games** (`/play/deck/[deck]`, `DeckScreen`): WYR, NHIE, truth/dare, conversation cards. Shared card in RTDB `cards/{deck}`; decks from `src/content/*.json` via `lib/decks.ts`; metadata in `lib/deckMeta.ts`.

| Screen | Route | Component | State |
| --- | --- | --- | --- |
| 20 Questions | `/play/twenty` | `TwentyScreen` | RTDB `twenty/main`, `lib/db/twenty` |
| Hangout wheel | `/play/wheel` | `WheelScreen` | result posted to chat |
| Trivia duel | `/play/trivia`, `/play/trivia/[id]` | `TriviaScreen` | Firestore `trivia/{id}` + RTDB cursor; `lib/trivia`, `lib/seeded` |
| Know-me quiz | `/play/quiz`, `/play/quiz/[id]` | `QuizScreen` | `quizzes/{id}` |
| Daily word | `/play/word` | `WordleScreen` | `wordle/{dateKey}_{uid}`, `lib/wordle` |
| Whiteboard | `/play/whiteboard` | `together/WhiteboardScreen` + `SharedCanvas` | RTDB `whiteboard/*`, `cursors/*`; snapshot → Cloudinary → chat |
| Pixel art | `/play/pixel` | `together/PixelScreen` | RTDB `pixel/grid` (1024 chars) |
| Pictionary | `/play/pictionary[/id]` | `together/PictionaryScreen` | RTDB `pictionary/{id}`, `lib/db/pictionary` |
| Watch together | `/play/watch` | `together/WatchScreen`, `YouTubePlayer` | RTDB `watch/main`, `lib/youtube` |
| Listen together | `/play/listen` | `together/ListenScreen` | RTDB `listen/main`, `listen/queue` |
| Radio | `/play/radio` | `together/RadioScreen` | RTDB `radio/main`, `content/radio.json` |
| Focus timer | `/play/timer` | `together/TimerScreen` | RTDB `timer/main`; sessions → `pair.focusSessions` |
| Cook-along | `/play/cook[/id]` | `together/CookScreen` | `recipes/{id}` + RTDB `cook/{id}` |

Heavy together screens are code-split through `together/lazy.tsx`. `ChatDrawer` gives any together screen a slide-up view of the main chat.

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

`ProfileCard` (nickname, city via `onboarding/CityPicker` → Open-Meteo geocode, avatar upload, bio), `PairCard` (friends-since, next meetup, relationship preset from `content/relationships.ts`, pet name, room tz), `ThemeSwitch` (`hooks/useTheme`), `ChatBackgroundCard`, `NotificationsCard` (master switch + per-type toggles, test push), `SoundsCard` (`lib/sounds`), `UsageCard` (metered Firestore reads/writes vs Spark quota), `DiagnosticsCard` (owner only: build, worker, auth, RTDB, Firestore, CSP, network, last 20 errors from `lib/diagLog.ts`, Copy diagnostics), sign out. `shell/UpdateWatcher` checks for new deploys on launch and resume.

## Pet (`/pet`) — `components/pet/PetScreen.tsx`

`AdoptCard` picks a species on first open; `PetBits` draws the sprite from `content/pets` by species/level/mood. Hunger and happiness are derived from `pair.pet.hungerAt/happyAt` (`100 − minutes/14.4`, see `lib/pet.ts`); Feed/Play reset the timestamps and post system messages. Level = streak ÷ 7. Hunger push comes from the tick.

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

## Cross-cutting

- **Auth & onboarding**: `components/auth/*` (SignInScreen, AuthGate, SetupScreen, TakenScreen), `components/onboarding/OnboardingScreen`, `components/pair/PairFullScreen`. `lib/auth.ts`, `lib/allowlist.ts`.
- **Shell**: `components/shell/AppShell`, `TabBar` (pending spinner on tapped tab), `OfflineBanner`; `lib/tabs.ts`.
- **Toasts**: `components/toast/ToastProvider`. **Live events**: `components/live/LiveEventsProvider`. **Push**: `components/push/PushController`, `lib/push.ts` (token), `lib/notify.ts` (client → `/api/push`).
- **UI kit**: `components/ui/*` (Avatar, Button, Card, CloudImage, Input, Portal, Sheet, Skeleton, Spinner, Splash, Switch, TabError). `CloudImage` is the only way to render a Cloudinary photo (srcset, blur-up, lazy); `next/image` is not used anywhere.
- **Web vitals**: `providers/WebVitals` logs CLS/LCP/INP to the console in development only.
- **Service worker**: `src/app/sw.ts` (precache, `/offline` fallback, runtime caches for Cloudinary/OSM/GIPHY/ytimg images, NetworkOnly for Firebase/Google/`/api`, FCM background handler, same-origin notification click).
