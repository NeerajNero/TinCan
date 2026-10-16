# Data model

Source of truth for shapes is `src/lib/types.ts`; for access rules it's `rules/firestore.rules.tmpl` and `rules/database.rules.json.tmpl`. This page explains intent and bounds.

## Firestore

| Collection | Doc id | Written by | Read bound | Notes |
| --- | --- | --- | --- | --- |
| `users/{uid}` | uid | owner only | 2 single docs | name, nickname, email (immutable), photoURL, avatar{url,publicId}, bio, tz, city, lat, lng, fcmTokens[], notif{enabled,…}, wordleSolved, chatBg{id, photoUrl?, photoPublicId?} (id ≤ 24 chars; photoUrl must be our Cloudinary cloud), createdAt (immutable). No other top-level fields allowed. |
| `pair/main` | fixed | either | 1 doc | uids[≤2] (can only grow, never lose a uid), roomTz, friendsSince, nextMeetup, relationship, streak, plant, pet, garden.stickers, records, focusSessions, milestonesSummary, tripsSummary, counters |
| `messages/{id}` | auto | sender creates; recipient marks delivered/read; sender edits/deletes; either reacts (own key) / hides for self | latest 50 + ≤3 pages by scroll, then a button; unread ≤99; latest 1 | text ≤2000, type in text/image/voice/gif/sticker/system, createdAt == server time, media URL must be our Cloudinary cloud (gif: media*.giphy.com); `media.variants` = signed delivery URLs, each validated as ours |
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
| `milestones/{id}` | auto | either | ≤100 | mirrored to `pair.milestonesSummary` |
| `lists/{kind}/items/{id}` | auto | shared, **except `gifts`: author-only read/write** | ≤200 per list | text ≤200, note ≤1000, url ≤500, order |
| `trips/{id}` | auto | either | ≤100 | days[{date, stops[]}] rebuilt from the range; mirrored to `pair.tripsSummary` |
| `availability/{uid}` | uid | owner | 2 docs | slots{mon..sun: ["09:00",…]}, tz |
| `gameResults/{id}` | gameId or `{game}-{ts}` | create-only by a player | ≤20 on expand | game, players, winnerId, endReason, moves |
| `quizzes/{id}` | auto | author edits; taker writes only `takenBy.{uid}` | ≤5 unread badge; ≤20 list | questions[{q, answer, decoys[3]}], status draft/published |
| `wordle/{dateKey}_{uid}` | room day + uid | owner | 2 docs | guesses ≤6, solved, done |
| `trivia/{id}` | auto | create by either; answers only own key | 1 doc + ≤10 list | seed, questionIds[10], answers{uid}, scores{uid}, mode live/async |
| `recipes/{id}` | auto | either | ≤50 | title, ingredients[], steps[] |
| `push/{id}`, `tickLog/{jobKey}`, `quota/{uid}_{day}` | — | **admin only** | — | push log (~200), job idempotency, API daily caps |

Composite indexes: none. Every query is a single-field order or equality-only filters; sorting by a second field happens client-side. If you ever add one, create `firestore.indexes.json`, reference it in `firebase.json`, and include it in `rules:deploy`.

## Media references

Every stored asset reference is `{ url, publicId, variants }` (messages.media, memories, journal/capsule `media[]`, users.avatar). `url` is the signed original; `variants` holds the signed URLs from `src/lib/media-variants.json`. `users.chatBg.photoUrl` is the memory's signed w640 variant. Render through `variantUrl()` / `CloudImage` only. Docs written before the migration may still hold public `/upload/` URLs, which are transformed client-side until `pnpm migrate-media --yes` runs.

## Realtime Database

| Node | Writer | Validation | Used by |
| --- | --- | --- | --- |
| `presence/{uid}` | owner | online bool, lastSeen number, status awake/sleeping, page ≤100 chars | PresenceController; read by LiveEvents (friend) |
| `typing/{uid}` | owner | number | chat header |
| `pings/{uid}/{pushId}` | **other** user creates; **owner** deletes | from == auth.uid, kind string, at | ping queue (`useIncomingPings`) |
| `lamp/{uid}` | either | on, color, until | lamps |
| `cursors/{uid}` | owner | x,y numbers in 0–1 | whiteboard |
| `whiteboard/strokes/{id}`, `whiteboard/live/{uid}` | both / owner | points string ≤24k, hex colour, width number | SharedCanvas |
| `pixel/grid`, `pixel/cursor/{uid}` | both / owner | grid exactly 1024 chars | pixel art |
| `games/{id}` | both | type, string state, turn, status, open bool, endReason enum, players{first,second}, reaction (own or unchanged) | board games |
| `cards/{deck}` | both | — | deck games |
| `pictionary/{id}` (+ strokes, live) | both | stroke/live limits as whiteboard | pictionary |
| `twenty/main` | both | — | 20 Questions (one round at a time) |
| `trivia/{id}` | both | — | live trivia cursor |
| `watch/main`, `listen/main`, `listen/queue` | both | — | watch/listen together |
| `radio/main`, `timer/main`, `cook/{recipeId}` | both | — | radio, focus timer, cook-along |

`.indexOn: ["open"]` on `games` serves the one landing query. All other RTDB reads are single nodes.

## Static content (`src/content/`)

Decks (`would-you-rather`, `never-have-i-ever`, `truths`, `dares`, `conversation-cards`), `hangout-ideas`, `trivia` (305), `twenty-secrets`, `pictionary-words`, `daily-questions` (384), `words-answers` (1,704) + `words-allowed` (8,574), `radio` (6 verified streams), `relationships.ts`, and SVG sets: `stickers/` (16), `pets/` (3 species), `plant/` (10 stages), `garden/` (scene + 24 stickers). Content is imported only by the screens that use it so it doesn't ride in the shared bundle (`deckMeta.ts` exists for that reason).
