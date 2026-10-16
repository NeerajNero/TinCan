# Security

## Model

Two allowlisted Google accounts are the only principals. Everything else is denied at three layers: the Firestore/RTDB rules (the real boundary), the API guard (server routes), and the client gate (UX only).

## Allowlist

`ALLOWED_EMAILS` (two emails) is read by the server (`lib/allowlist.ts`) and baked into the rules by `scripts/build-rules.mjs` from `rules/*.tmpl` (`__ALLOWED_EMAILS__`, `__CLOUDINARY_CLOUD__` placeholders). The generated `firestore.rules`, `database.rules.json` and `.firebaserc` are gitignored, so emails never land in git. Changing the allowlist = update env in all places + `pnpm rules:deploy` + redeploy Vercel.

## Rules (`rules/firestore.rules.tmpl`, `rules/database.rules.json.tmpl`)

Default deny. `allowed()` requires a signed-in, `email_verified`, allowlisted user. Then per collection (full table in data-model.md):

- **Ownership**: `users/{uid}` own-write; `email`/`createdAt` immutable; no unknown top-level fields. `availability`, `moods`, `wordle` own-write.
- **Messages**: create only as sender with `createdAt == request.time`, text ≤2000, type enum, media URLs must be `https://res.cloudinary.com/<cloud>/` (gif: `https://media*.giphy.com/`). Recipient may only touch `deliveredAt/readAt/status`; sender edits/deletes; either sets only its own `reactions.{uid}` / `deletedFor` entry.
- **Private bodies**: `capsules/{id}/private/body` readable by author or when `request.time >= unlockAt`; `envelopes/{id}/private/body` readable by author, or by `forUid` once `openedAt` is set.
- **Gifts list** is readable/writable only by whoever added the item.
- **pair/main**: `uids` can only grow and never lose a uid.
- **Admin only**: `push`, `tickLog`, `quota`, `scheduled` delivery fields.
- **RTDB**: `presence/typing/cursors` own-write with validated shapes (presence page ≤100 chars, cursor coords 0–1); `pings/{uid}/{id}` created by the other user, deleted by owner; `games` validate `type/state/turn/status/open/endReason/players` and allow an unchanged opponent reaction on a transaction rewrite; `whiteboard`/`pictionary` strokes ≤24k chars; `pixel/grid` exactly 1024 chars.

Covered by `tests/rules.test.ts` (emulator). Run `pnpm test:rules` after any rules change.

## API guard (`src/lib/server/guard.ts`)

ID token verified with revocation check → `email_verified` + allowlist → per-uid token bucket → Firestore daily cap (`quota/{uid}_{day}`: push 1000, media 300, sign 300) → 16 KB body → `.strict()` zod. `/api/tick` compares `x-tick-secret` with `timingSafeEqual`. Response bodies carry only an error code.

## Media

Uploads are **signed** and **private**. The browser asks `POST /api/media/sign` for a signature over a fixed parameter set (timestamp, folder, preset, `type=authenticated`, the incoming transformation for images), after a size check (5 MB / 3 MB). It uploads straight to Cloudinary, then calls `POST /api/media/urls` once for signed delivery URLs of the fixed variant set, and stores them on the doc. Authenticated assets return **401** without a valid signature, and a tampered transformation also gets 401 (verified against the live cloud). A signed URL never expires and opens exactly one variant of one asset; anyone holding it can load that variant, so treat the URLs (and `pnpm export` output) as private.

The presets `tincan_image` and `tincan_audio` must be Signed mode with delivery type authenticated (`pnpm cloudinary:presets` sets both). Deletes go through `DELETE /api/media`, which checks the caller owns the doc and destroys the asset under either delivery type. The app renders only `res.cloudinary.com/<cloud>/(image|video)/(upload|authenticated/s--sig--)/…` and GIPHY media (`lib/safeUrl.ts`); the rules enforce the same pattern on every stored URL and variant. User-typed links (lists) render only when http(s).

## Headers (`next.config.ts`)

- `Content-Security-Policy` is **enforced** and built in `csp.ts`. `src/proxy.ts` generates a nonce per page request; `script-src` is `'self' 'nonce-…'` plus YouTube, `s.ytimg.com` and `apis.google.com`, with no `'unsafe-inline'`. Next stamps the nonce on its inline bootstrap scripts and the root layout on the theme script. Hashes and SRI were tried and don't work: SRI only covers external files, and Next's inline scripts differ per route and per build. The cost is that every page is dynamically rendered.
- The service worker has its own policy, from the `/serwist/*` response headers: `default-src 'self'; script-src 'self'; connect-src <same list>`. Its runtime-cache fetches count as connect-src, so every cached host (Cloudinary, OSM tiles, GIPHY, ytimg) is in connect-src as well as img-src. Serwist's two cross-origin catch-all routes are removed, so avatars, YouTube scripts and radio streams no longer pass through the worker.
- If something breaks, set `CSP_REPORT_ONLY=1` on Vercel to send both policies as report-only, fix `csp.ts`, then unset it. `pnpm test:e2e` checks that the header is enforced and nonce-based, and that loading `/signin` and every cached image host raises no violation in the page or the worker.
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` allowing only microphone(self) and media playback. `/serwist/*` is `max-age=0, must-revalidate`.

## Third parties

The full list of what leaves Firebase and Cloudinary, and to whom, is in the README under Privacy & access. GIPHY is called only from `/api/gif` (key server-side). The YouTube player uses `youtube-nocookie.com`. `/api/tick` live responses carry counts only. `/api/health` reports booleans and an error name.

## Secrets handling

- All env values live in `.env` / `.env.local` (gitignored) and on Vercel. Scripts read `.env.local` then `.env` and **never print values**; emails are masked in output.
- `FIREBASE_SERVICE_ACCOUNT` is base64 JSON consumed only by `lib/firebase/admin.ts`; `CLOUDINARY_API_SECRET` only by `/api/media` and `/api/media/sign`; `TICK_SECRET` only by `/api/tick`.
- The service worker caches only images and tiles (CacheFirst) and never Firebase, Google or `/api/*` responses.
- `NEXT_PUBLIC_*` are public by design (Firebase web config, Cloudinary cloud name). `GIPHY_API_KEY` is server-only. The client bundle was grepped for every secret name and value (Cloudinary secret, tick secret, GIPHY key, service account and its private key): 0 matches.
- `/api/health` returns booleans only.
- Dependency overrides in `package.json`: `jose@5.10.0` (firebase-admin ESM crash on Vercel) and `@grpc/grpc-js >= 1.13.6` (advisory). Run `pnpm audit --prod` after upgrades.
