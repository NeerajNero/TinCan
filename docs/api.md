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
| `POST /api/media/sign` | sign | 20 / 0.3 | 300 | `{ kind: "image" \| "audio", bytes }` (≤5 MB image, ≤3 MB audio) | `{ signature, apiKey, cloudName, params, resourceType }`; params include `type: "authenticated"` |
| `POST /api/media/urls` | urls | 20 / 0.3 | 300 | `{ publicId: "tincan/images/…" \| "tincan/audio/…", purpose: "image" \| "avatar" \| "audio", format? }` | `{ variants }`: signed URLs for the fixed variant set (`src/lib/media-variants.json`) |
| `GET /api/gif` | gif | 20 / 1 | 1000 | query `q?` (≤ 80 chars), or `mode=status` | `{ enabled, gifs[] }` (GIPHY search/trending, rating pg; trending cached 10 min per instance) |
| `DELETE /api/media` | media | 15 / 0.25 | 300 | `{ kind: "message" \| "memory" \| "journal" \| "capsule", id }` · `{ kind: "avatar" }` · legacy `{ messageId }` | `{ ok: true }` after Cloudinary destroy + Firestore update |
| `GET /api/tick` | secret header | — | — | header `x-tick-secret`; `?dry=1` | live: `{ ok, now, actions: <count>, jobs: {job: count} }` (no names or text: cron-job.org keeps bodies); dry: full `actions[]` |
| `GET /api/health` | none (deliberate) | — | — | — | booleans only: Node version, which env keys are set, whether the admin SDK loads (error *name* only) |
| `GET /serwist/sw.js` | none | — | — | — | the built service worker (Firebase public config inlined via esbuild `define`) |

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
| abandonStaleGames | every tick | — | games idle 7 days → `abandoned`; finished > 6 h → `open: false` |
| petHunger | every tick, once a day | `pet-hungry-{dateKey}` | hunger hits 0 within 2 h → `petHungry` + system message |
| morningDigest | per user, at `notif.digest.hour` in their tz | `digest-{uid}-{localDateKey}` | your-turn games / invites (RTDB `games` open index), undrawn jar notes (≤ 10), unanswered daily question, pet food/joy < 30, capsules unlocking today, milestones today, unread count → one `digest` push (`lib/digest.digestPush`), or nothing |
| monthlyRecap | 1st of the month, 09:00 | `recap-{yyyy-MM}` | 2 `count()` on messages (senderId + createdAt range), 3 on gameResults (winnerId + endedAt range), stickers from `pair.garden`, `streak.monthBest`, favourite ping from `counters.pingCounts` − `pair.recap.pingCounts` → `recap` system line (`lib/recap.recapLine`); then resets `streak.monthBest` and snapshots the ping counts on `pair.recap`. No push |

`pnpm tick:dry` calls `?dry=1` (set `TICK_URL` to target a deployment) and prints the actions without writing or sending.
