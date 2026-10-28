# Data model

Source of truth for shapes is `src/lib/types.ts`; for access rules it's `rules/firestore.rules.tmpl` and `rules/database.rules.json.tmpl`. This page explains intent and bounds.

## Firestore

| Collection | Doc id | Written by | Read bound | Notes |
| --- | --- | --- | --- | --- |
| `users/{uid}` | uid | owner only | 2 single docs | name, nickname, email (immutable), photoURL, avatar{url,publicId}, bio, tz, city, lat, lng, fcmTokens[], notif{enabled,…, digest{enabled, hour}}, wordleSolved, createdAt (immutable). No other top-level fields allowed; a legacy `chatBg` (pre-22b) may only be deleted, which the wallpaper migration does. |
| `pair/main` | fixed | either | 1 doc | uids[≤2] (can only grow, never lose a uid), roomTz, friendsSince, nextMeetup, relationship, streak, plant, pet, garden.stickers, records, focusSessions, milestonesSummary, tripsSummary, counters{pings, pingCounts{kind}}, recap{month, pingCounts} (written by the recap tick job); streak{count, lastDateKey, best, monthBest, shields, shieldUsedOn}; chatBg{id, photoUrl?, photoPublicId?} (shared wallpaper; id ≤ 24 chars, photoUrl must be our Cloudinary cloud; null = plain) + chatBgBy |
| `messages/{id}` | auto | sender creates; recipient marks delivered/read; sender edits/deletes; either reacts (own key) / hides for self | latest 50 + ≤3 pages by scroll, then a button; unread ≤99; latest 1 | text ≤2000, type in text/image/voice/gif/sticker/system, createdAt == server time, media URL must be our Cloudinary cloud (gif: media*.giphy.com); `media.variants` = signed delivery URLs, each validated as ours; system lines (`type: "system"`) also carry `kind` (string ≤32) and optional `meta` (flat map ≤8 keys), allowed on system lines only, written by `lib/chat/system.createSystemMessage` (server: `postSystemMessageAdmin`) without `deliveredAt`/`readAt`; `kind == "invite"` requires `meta` = { route (same-origin path ≤ 100), activity (≤ 32), label (1–80), expiresAt (number), roundId? (≤ 64) } and nothing else |
| `playlists/{room}` | `watch` or `listen` | either; `updatedBy` must be the writer | 1 doc on that screen | `{ items[≤50]{videoId, title ≤200, addedBy, addedAt (client ms)}, updatedAt, updatedBy }`; only those three keys; every edit is a transaction over `lib/playlist.ts`; thumbnails derived (`i.ytimg.com/vi/{id}/mqdefault.jpg`), never stored |
| `checkins/{dateKey}` | room day | each uid sets only its own key | 1 doc | `{uid: true}` |
| `moods/{dateKey}_{uid}` | own day + uid | owner | 2 docs today; ≤70 per month | emoji, note ≤80, dateKey, uid (mirror fields must match id) |
| `dailyQuestions/{dateKey}` | room day | each uid only its own `answers.{uid}`; `dateKey` mirror | 1 doc today; history 30/page by `dateKey` | questionIndex |
| `journal/{id}` | auto | author | 20/page by createdAt | text ≤4000, mood, media[] |
| `capsules/{id}` + `private/body` | auto | author; non-author may set openedAt/openedBy after unlockAt | ≤50 | body readable by author or after unlockAt; author may delete while locked |
| `envelopes/{id}` + `private/body` | auto | author; recipient sets openedAt once | ≤50 for me + ≤50 by me | body readable by author, or recipient after opening |
| `jar/{id}` | auto | author creates (text ≤500); recipient sets drawnAt | ≤100 for me + ≤100 by me | `drawnAt: null` on create so `== null` queries work |
| `scheduled/{id}` | auto | sender; delivered by the tick (admin) | ≤50 pending | sendAt, sentAt, messageId |
| `memories/{id}` | auto | uploader (edit/delete); create requires our Cloudinary URL | 40/page by takenAt; ≤30 per place | caption ≤500, takenAt, placeId, sharedAsset, `variants` (signed URLs). Either user may null `placeId` when its place is deleted in the same batch |
| `places/{id}` | auto | either | ≤200 | name ≤80, note ≤1000, kind been/want, visitedAt |
| `milestones/{id}` | auto | either | ≤100 | title, date, repeatYearly, emoji, effect? (diyas | colours | snow | fireworks | kites | flowers | confetti), verify? (date to double-check; cleared by editing the date or "Looks right"); mirrored to `pair.milestonesSummary`; "Add festivals" batch-writes `content/festivals.json` |
| `lists/{kind}/items/{id}` | auto | shared, **except `gifts`: author-only read/write** | ≤200 per list | text ≤200, note ≤1000, url ≤500, order |
| `trips/{id}` | auto | either | ≤100 | days[{date, stops[]}] rebuilt from the range; mirrored to `pair.tripsSummary` |
| `availability/{uid}` | uid | owner | 2 docs | slots{mon..sun: ["09:00",…]}, tz |
| `gameResults/{id}` | gameId, `{game}-{ts}`, or `word-{dateKey}` | create-only by a player | ≤20 on expand | game, players, winnerId, endReason, moves (daily word: the winning guess count) |
| `quizzes/{id}` | auto | author edits; taker writes only `takenBy.{uid}` | ≤5 unread badge; ≤20 list | questions[{q, answer, decoys[3]}], status draft/published |
| `wordle/{dateKey}_{uid}` | room day + uid | owner | 2 docs; History: one 60-doc `getDocs` by id desc, on tap; first settle: one ≤200-doc read | guesses ≤6, solved, done, at |
| `trivia/{id}` | auto | create by either; answers only own key | 1 doc + ≤10 list | seed, questionIds[10], answers{uid}, scores{uid}, mode live/async |
| `recipes/{id}` | auto | either | ≤50 | title, ingredients[], steps[] |
| `push/{id}`, `tickLog/{jobKey}`, `quota/{uid}_{day}` | — | **admin only** | — | push log (~200), job idempotency, API daily caps |

Composite indexes (`firestore.indexes.json`, referenced from `firebase.json`, deployed by `pnpm rules:deploy`): `messages (senderId ASC, createdAt ASC)` and `gameResults (winnerId ASC, endedAt ASC)`, both for the monthly recap's `count()` queries in `/api/tick` (equality + range on another field). Every client query is a single-field order, equality-only filters (merged single-field indexes), a range on one field, or an ascending document-id range (`wordle` history); sorting by a second field happens client-side. `tests/unit/rules-coverage.test.ts` classifies every client `query(...)` in `src/` and every admin `collection("x").where(...)…` chain, fails with the exact entry to add when one needs a composite index the file lacks, and fails on `orderBy(documentId(), "desc")` (needs `__name__ DESC`, which the file cannot express).

## Media references

Every stored asset reference is `{ url, publicId, variants }` (messages.media, memories, journal/capsule `media[]`, users.avatar). `url` is the signed original; `variants` holds the signed URLs from `src/lib/media-variants.json`. `users.chatBg.photoUrl` is the memory's signed w640 variant. Render through `variantUrl()` / `CloudImage` only. Docs written before the migration may still hold public `/upload/` URLs, which are transformed client-side until `pnpm migrate-media --yes` runs.

## Realtime Database

| Node | Writer | Validation | Used by |
| --- | --- | --- | --- |
| `presence/{uid}` | owner | online bool, lastSeen number, status awake/sleeping, page ≤100 chars | PresenceController; read by LiveEvents (friend) |
| `typing/{uid}` | owner | number | chat header |
| `pings/{uid}/{pushId}` | **other** user creates; **owner** deletes | from == auth.uid, kind string, at | ping queue (`useIncomingPings`) |
| `invites/{uid}/{pushId}` | **other** user creates; **owner** deletes; **owner** reads | from == auth.uid, activity 1–32, label 1–80, route a same-origin path (`/…`, never `//host`, ≤ 100), at number ≤ now; no other children | invite toast queue (`useIncomingInvites`): Join / Not now, deleted once shown, dropped if > 2 min old on open |
| `lamp/{uid}` | either | on, color, until | lamps |
| `cursors/{uid}` | owner | x,y numbers in 0–1 | whiteboard |
| `whiteboard/strokes/{id}`, `whiteboard/live/{uid}` | both / owner | points string ≤24k, hex colour, width number | SharedCanvas |
| `pixel/grid`, `pixel/cursor/{uid}` | both / owner | grid exactly 1024 chars | pixel art |
| `games/{id}` | both | type, string state, turn, status, open bool, endReason enum, players{first,second}, reaction (own or unchanged) | board games |
| `cards/{deck}` | both | — | deck games |
| `pictionary/{id}` (+ strokes, live) | both | stroke/live limits as whiteboard; `rounds` 3 or 5 (absent = 3), `roundStartedAt` is a server timestamp | pictionary |
| `twenty/main` | both | — | 20 Questions (one round at a time) |
| `trivia/{id}` | both | qIndex, qStartedAt numbers; startedBy string; `joined/{uid}` and `answered/{uid}` numbers, own key or unchanged (transactions rewrite the node); nothing else | live trivia session: `joined/{uid}` on open, start transaction once both joined, `answered` per question, cleared on advance; removed by `switchToAsync` |
| `watch/main`, `listen/main`, `listen/queue` | both | — | watch/listen together |
| `roomchat/{room}/{pushId}` (`room` = `watch` / `listen`) | owner creates (`uid == auth.uid`), either deletes, no edits; either may remove the whole room | uid, text 1–500 chars, at number ≤ now; no other children | Watch / Listen side chat (`hooks/useRoomChat`): one `orderByKey().limitToLast(60)` query while the screen is open, newest 50 shown; the sender trims anything beyond 50 after each send |
| `radio/main`, `timer/main`, `cook/{recipeId}` | both | — | radio, focus timer, cook-along |

`.indexOn: ["open"]` on `games` and on `pictionary` serves the two landing queries (`orderByChild("open").equalTo(true)`, also used by the tick's stale-game sweep). All other RTDB reads are single nodes or `orderByKey()` windows, which need no index. `tests/unit/rules-coverage.test.ts` fails on any `orderByChild` field without an `.indexOn` on its node.

## Static content (`src/content/`)

Decks (`would-you-rather`, `never-have-i-ever`, `truths`, `dares`, `conversation-cards`), `trivia` (305), `twenty-secrets`, `pictionary-words`, `festivals` (12 yearly entries, 2026–2028, `verify` years for lunar dates), `daily-questions` (384), `words-answers` (1,704) + `words-allowed` (8,574), `radio` (12 verified streams: 6 World mp3, 6 All India Radio HLS with `region`, `language`, `format`, optional `hosts` for redirect/segment hosts; read through `lib/radio.ts`), `relationships.ts`, and SVG sets: `stickers/` (16), `pets/` (3 species), `plant/` (10 stages), `garden/` (scene + 24 stickers). Content is imported only by the screens that use it so it doesn't ride in the shared bundle (`deckMeta.ts` exists for that reason).
