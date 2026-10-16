# Operations

## Environments

| Thing | Where |
| --- | --- |
| Production | Vercel Hobby, project `tin-can`, https://tin-can.vercel.app, Node 22 (`engines.node` in package.json) |
| Firebase | one Spark project; Firestore + RTDB (asia-southeast1) + Auth (Google) + Cloud Messaging |
| Media | Cloudinary free tier, folders `tincan/images`, `tincan/audio`, presets in Signed mode |
| Scheduler | cron-job.org → `GET /api/tick` every 15 min with header `x-tick-secret` |
| Backup | the git remote. Push after every commit. |

## Env

`.env.example` lists every variable (`CSP_REPORT_ONLY=1` is the only debug switch). Locally the values live in `.env` (or `.env.local`), both gitignored; scripts read `.env.local` then `.env`. Vercel holds the same set under Settings → Environment Variables. Never print or paste values into a chat, a log or a commit.

## Scripts

| Script | Does |
| --- | --- |
| `pnpm dev` | Next dev server. Service worker and push are disabled in dev. |
| `pnpm build` / `pnpm start` | Production build / server |
| `pnpm typecheck` | `next typegen && tsc --noEmit` |
| `pnpm lint` | ESLint with Next core-web-vitals + TypeScript + React Compiler rules |
| `pnpm rules:build` | `rules/*.tmpl` → `firestore.rules`, `database.rules.json`, `.firebaserc` |
| `pnpm rules:deploy` | build, then `firebase deploy --only firestore:rules,database` (needs `npm i -g firebase-tools` and `firebase login`) |
| `pnpm test` | vitest unit tests in `tests/unit` (engines, dates/streak, pet, availability, ping cooldown) |
| `pnpm test:rules` | build rules, start the emulators (Firestore 8181, RTDB 9191; needs Java), run `tests/rules.test.ts` |
| `pnpm test:e2e` | production build + Playwright layout smoke test (mobile viewport; first run `npx playwright install chromium`) |
| `pnpm profile:chat` | React Profiler run of a 300-message thread in happy-dom; prints mount and append cost |
| `pnpm analyze` | production build with the bundle analyzer report |
| `pnpm knip` | dead code / unused exports / unused deps; must be clean |
| `pnpm cloudinary:presets` | create/update the two upload presets (Signed mode, delivery type authenticated) |
| `pnpm migrate-media` | dry run: counts public assets under `tincan/` and docs referencing them; `--yes` moves them to authenticated delivery and rewrites every stored URL with signed variants |
| `pnpm export` | backup: dated `exports/<time>/firestore.json` + `media.csv` (gitignored, private) |
| `pnpm tick:dry` | `GET $TICK_URL/api/tick?dry=1` and print what the tick would do |
| `pnpm reset:dry` / `pnpm reset` | wipe all data except the owner's `users` doc (owner = first email in `ALLOWED_EMAILS`); dry run by default |
| `pnpm icons` | regenerate PWA icons and badge from the inline SVG |

## Deploying

1. `pnpm typecheck && pnpm lint` (and `pnpm build` for anything touching config, the worker or dependencies).
2. Commit, `git push` → Vercel builds `main` automatically.
3. If `rules/*.tmpl` changed: `pnpm rules:deploy`. The app and rules are deployed separately. A rules change without a deploy shows up as `permission-denied` in the console.
4. If `src/app/sw.ts` or precached assets changed, the worker updates on next load; a hard refresh or reinstall is never required.
5. Check `/api/health` and the console for CSP reports after a config change.

## Routine checks

- **Quota**: More → Usage meter on a phone after a normal day. Spark gives 50k reads / 20k writes a day; the app is designed to sit far under that.
- **RTDB connections**: 100 simultaneous on Spark; the app keeps ≤ ~6 per client. If a screen leaks a listener, `useRtdbValue` with a `null` path on unmount is the pattern.
- **Push**: More → Notifications → "Send a test". A failure there means the token, the VAPID key or the service worker registration.
- **Tick**: cron-job.org history should show 200s; `pnpm tick:dry` locally against production to see the plan.
- **Dependencies**: `pnpm outdated`, `pnpm audit --prod`.

## Backups

Spark has **no managed Firestore exports**, so `pnpm export` is the only backup. It writes every collection, plus the `private` and `items` subcollections, with tagged timestamps, and a CSV of every media URL. The signed URLs in the CSV open the originals, so keep the folder somewhere private. Cloudinary keeps the media itself. Run it before risky changes and every few weeks.

## Resetting data

`pnpm reset:dry` prints what would be deleted (all Firestore collections, all RTDB nodes, every `users` doc but the owner's, and the Cloudinary folders). `pnpm reset` does it. Both users must then sign in again; the second sign-in re-forms the pair.

## Changing the pair

Edit `ALLOWED_EMAILS` locally and on Vercel → `pnpm rules:deploy` → redeploy Vercel → if a uid is being replaced, `pnpm reset` (the `uids` array on `pair/main` can only grow, by design).
