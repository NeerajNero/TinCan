# API routes

All routes live in `src/app/api/*/route.ts`. Every authenticated route goes through `guard(req, routeKey)` from `src/lib/server/guard.ts`, which:

1. Verifies the Firebase ID token in `Authorization: Bearer …` **with revocation checking**.
2. Requires `email_verified` and an allowlisted email.
3. Applies an in-memory token bucket per uid per route, and for costly routes a Firestore daily cap in admin-only `quota/{uid}_{day}`.
4. `readJson(req, schema)` enforces a 16 KB body limit and a `.strict()` zod schema.

Errors go back as `{ error: "<code>" }` with 400/401/403/413/429/500; details are only logged server-side. Clients call these through `lib/api.authedFetch(path, init)` which attaches the token.

| Route | Guard key | Bucket (cap / refill per s) | Daily cap | Body | Returns |
| --- | --- | --- | --- | --- | --- |
| `POST /api/gate` | gate | 10 / 0.2 | — | none | `{ allowed: boolean }` — 403 from the guard becomes `allowed: false` |
| `POST /api/push` | push | 30 / 0.5 | 1000 | `{ type: PushType, payload?: { toUid?, title?, body?, data? }, toSelf? }` | `{ sent, reason? }` |
| `POST /api/media/sign` | sign | 20 / 0.3 | 300 | `{ kind: "image" \| "audio", bytes, folder?: "snaps" }` (≤5 MB image, ≤3 MB audio) | `{ signature, apiKey, cloudName, params, resourceType }`; params include `type: "authenticated"` and the folder (`tincan/images`, `tincan/snaps` for the daily snap, `tincan/audio`) |
| `POST /api/media/urls` | urls | 20 / 0.3 | 300 | `{ publicId: "tincan/images/…" \| "tincan/snaps/…" \| "tincan/audio/…", purpose: "image" \| "avatar" \| "audio", format? }` | `{ variants }`: signed URLs for the fixed variant set (`src/lib/media-variants.json`) |
| `GET /api/gif` | gif | 20 / 1 | 1000 | query `q?` (≤ 80 chars), or `mode=status` | `{ enabled, gifs[] }` (GIPHY search/trending, rating pg; trending cached 10 min per instance) |
| `POST /api/games/hangman/guess` | games (`guardFast`) | 40 / 1 | — (in-memory bucket only) | `{ gameId, letter: a–z }` | `{ hit, roundOver, finished, winnerId }`; 404 unknown game, 409 `not_playable` / `not_your_turn` / `already_guessed` / `no_word` (setter's private word missing or for another round) / `move_rejected` |
| `POST /api/games/battleship/shot` | games (`guardFast`) | 40 / 1 | — (in-memory bucket only) | `{ gameId, cell: 0–99 }` | `{ result: hit \| miss \| sunk, finished, winnerId }`; 409 `not_playable` / `not_your_turn` / `already_shot` / `no_fleet` / `move_rejected` |
| `DELETE /api/media` | media | 15 / 0.25 | 300 | `{ kind: "message" \| "memory" \| "journal" \| "capsule", id }` · `{ kind: "avatar" }` · legacy `{ messageId }` | `{ ok: true }` after Cloudinary destroy + Firestore update. `kind: "message"` by the sender soft-deletes for everyone; by the **recipient** it is allowed only on a `viewOnce` photo / voice note (phase 27): the asset is destroyed and `media` cleared (plus `viewedAt` if missing) while the line stays, so both bubbles read "Opened" |
| `GET /api/rules/status` | rules | 5 / 0.05 | 50 | — | `{ live: { rtdb, firestore }, expected, checkedAt }`: the `RULES_VERSION` markers read from the live RTDB rules (admin `getRules()`) and the live Firestore rules (Firebase Rules API), each `null` when missing or unreadable, next to this build's `NEXT_PUBLIC_RULES_VERSION`. For More → Diagnostics; the tick's drift job uses the same `lib/server/rulesDrift.liveRulesStatus()` |
| `GET /api/tick` | secret header | — | — | header `x-tick-secret`; `?dry=1` | live: `{ ok, now, actions: <count>, jobs: {job: count} }` (no names or text: cron-job.org keeps bodies); dry: full `actions[]` |
| `GET /api/health` | none (deliberate) | — | — | — | booleans only: Node version, which env keys are set, whether the admin SDK loads (error *name* only) |
| `GET /serwist/sw.js` | none | — | — | — | the built service worker (Firebase public config inlined via esbuild `define`) |

## `/api/games/*` semantics

`src/lib/server/games.ts`. Both routes are on the tap → board path, so they use `guardFast` (token verified against cached public keys, no revocation lookup, in-memory bucket, no Firestore) and `openGame(id)`: a value listener is attached to `games/{id}` and the node plus every `gamePrivate/{id}/*` subtree are fetched in parallel (one round trip; the private data never leaves the server). The route checks type, `status == "active"`, that the caller is the player to move (`hangmanMover` / `turn`) and the private value (the Hangman word must pass `hangmanWordError` and carry the current `round`; the fleet must be `fleetValid`), then `commit(fn)` rewrites the node in an RTDB transaction that starts from the cached value, so it is one round trip instead of a null pass plus a rerun (the pure `applyHangmanGuess` / `applyShot`, `turn`, `moves`, `lastMoveAt`, `finishedFields` on a win; undefined aborts with 409 `move_rejected`). The response goes out at once; `afterServerMove` runs in Next's `after()`: the `yourTurn` push when the move handed the turn over (skipped while the recipient is on that game's page), or on a finish what the client does for engine games: `gameResults/{id}` (create-only), `pair.records[type]` in a transaction, the `game-result` system line and the result push to the opponent. Measured locally with `pnpm perf:turn` (emulators + `next start`; absolute numbers are small because every hop is on localhost, the production gain is the ten or so awaited round trips removed): a shot answered in 31 → 12 ms median and reached the listener in 22 → 11 ms; a guess 23 → 10 ms and 19 → 9 ms.

## `/api/push` semantics

`src/lib/server/push.ts → sendPushTo(toUid, type, opts)`:

- Looks up the recipient; returns early when `notif.enabled` is false or the per-type toggle (`TOGGLE_FOR[type]`) is off.
- Skips when the recipient's RTDB presence `page` already is the target (e.g. chat open and visible).
- Composes title/body/url via `composePush` in `src/lib/pushTypes.ts`; sends **data-only** FCM messages; prunes tokens that fail with `registration-token-not-registered`.
- Logs to `push/{id}` (pruned to ~200) for de-duplication of event-keyed pushes.
- `postSystemMessageAdmin(senderId, text)` writes a `system` chat message with the admin SDK (used by the tick).

Push types: `message, ping, lamp, test, daily-answer, daily-nudge, streak-risk, capsule-unlocked, envelope-opened, jar, scheduled, milestone, meetup, yourTurn, invite, petHungry, digest` (`digest` is governed by `notif.digest.enabled` rather than a boolean toggle; checked in `sendPushTo`). Adding one is described in adding-a-feature.md.

## `/api/tick` jobs

Each job runs inside `once(ctx, job, key, body)` which checks and writes `tickLog/{key}`; time-of-day jobs fire when the room-tz minute is within a 15-minute window after the target.

| Job | When | Key | Does |
| --- | --- | --- | --- |
| deliverScheduled | every tick | `scheduled-{id}` | creates the message, sets `sentAt/messageId`, pushes `scheduled` |
| dailyNudge | 20:00 | `nudge-{dateKey}` | pushes `daily-nudge` to whoever hasn't answered |
| streakRisk | 21:00 | `streak-{dateKey}` | if exactly one checked in → `streak-risk` to the other ("…a shield will cover tonight, but say hi anyway?" when `streak.shields > 0`) |
| capsulesUnlocked | every tick (48 h lookback) | `capsule-{id}` | pushes `capsule-unlocked` to both |
| reminders | 09:00 | `remind-{dateKey}` | milestones today, meetup/trip in 7 or 1 days → `milestone` / `meetup` |
| abandonStaleGames | every tick | — | games idle 7 days → `abandoned`; finished > 6 h → `open: false`; both also remove `gamePrivate/{id}` |
| petHunger | every tick, once a day | `pet-hungry-{dateKey}` | hunger hits 0 within 2 h → `petHungry` + system message |
| verifyDates | 09:00 | `verify-date-{dateKey}` | milestones with `verify: true` whose next occurrence is exactly 7 days away (`lib/milestones.verifyDueIn`) → `milestone` push to both, "Is this date right?", url `/memories/milestones?edit={id}` |
| morningDigest | per user, at `notif.digest.hour` in their tz | `digest-{uid}-{localDateKey}` | your-turn games / invites (RTDB `games` open index), undrawn jar notes (≤ 10), unanswered daily question, pet food/joy < 30, capsules unlocking today, milestones today, unread count, and (one read, only once today's snap minute + 2 min has passed) "📸 today's snap is still waiting for yours" → one `digest` push (`lib/digest.digestPush`), or nothing |
| snapSchedule | from 00:05, the first tick of a day without a minute | `snap-schedule-{dateKey}` | `lib/snap.pickSnapMinute(Math.random(), minutes + 1)`: uniform in [09:00, 22:00) or what is left of it → `pair/main.snap.todayKey / todayAt`; "too late" after 22:00 |
| snapTime | every tick once `now ≥ snap.todayAt` | `snap-push-{dateKey}` | `snap` push to both ("📸 Snap time! You have 2 minutes", url `/snap`) |
| housekeeping | 03:00 | `housekeeping-{dateKey}` | `users/{uid}.note` past `expiresAt` → null (`lib/notes.noteExpired`); `snaps` with `dateKey < today − 60` (≤ 20 days per run, a single-field range): entries not `savedToMemories` → `destroyAsset` + delete, the summary deleted when no entry is left |
| monthlyRecap | 1st of the month, 09:00 | `recap-{yyyy-MM}` | 2 `count()` on messages (senderId + createdAt range), 3 on gameResults (winnerId + endedAt range), stickers from `pair.garden`, `streak.monthBest`, favourite ping from `counters.pingCounts` − `pair.recap.pingCounts` → `recap` system line (`lib/recap.recapLine`); then resets `streak.monthBest` and snapshots the ping counts on `pair.recap`. No push |

`pnpm tick:dry` calls `?dry=1` (set `TICK_URL` to target a deployment) and prints the actions without writing or sending.
