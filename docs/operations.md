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

`.env.example` lists every variable (`CSP_REPORT_ONLY=1` is the only debug switch; `E2E_HARNESS=1` is for Playwright only and is never set on Vercel). Locally the values live in `.env` (or `.env.local`), both gitignored; scripts read `.env.local` then `.env`. Vercel holds the same set under Settings → Environment Variables. Never print or paste values into a chat, a log or a commit.

## Scripts

| Script | Does |
| --- | --- |
| `pnpm dev` | Next dev server. Service worker and push are disabled in dev. |
| `pnpm build` / `pnpm start` | Production build / server |
| `pnpm typecheck` | `next typegen && tsc --noEmit` |
| `pnpm lint` | ESLint with Next core-web-vitals + TypeScript + React Compiler rules |
| `pnpm rules:build` | `rules/*.tmpl` → `firestore.rules`, `database.rules.json`, `.firebaserc` |
| `pnpm rules:deploy` | build, then `firebase deploy --only firestore:rules,firestore:indexes,database` — rules plus `firestore.indexes.json` (needs `npm i -g firebase-tools` and `firebase login`). Index builds take a few minutes; the Firebase console → Firestore → Indexes shows progress |
| `pnpm test` | vitest unit tests in `tests/unit` (engines, dates/streak, pet, availability, ping cooldown) |
| `pnpm test:rules` | build rules, start the emulators (Firestore 8181, RTDB 9191; needs Java), run `tests/rules.test.ts` |
| `pnpm test:e2e` | production build + Playwright layout smoke test (mobile viewport; first run `npx playwright install chromium`) |
| `pnpm profile:chat` | React Profiler run of a 300-message thread in happy-dom; prints mount and append cost |
| `pnpm analyze` | production build with the bundle analyzer report |
| `pnpm size [routes…] [--save f] [--compare f]` | after `pnpm build`: starts `next start` on `SIZE_PORT` (3999), sums each route's initial JS (raw and gzip -9), prints a table and stops the server. `--save` keeps a baseline and `--compare` adds a Δ column. This is the number bundle budgets refer to |
| `pnpm knip` | dead code / unused exports / unused deps; must be clean |
| `pnpm cloudinary:presets` | create/update the two upload presets (Signed mode, delivery type authenticated) |
| `pnpm migrate-media` | dry run: counts public assets under `tincan/` and docs referencing them; `--yes` moves them to authenticated delivery and rewrites every stored URL with signed variants |
| `pnpm export` | backup: dated `exports/<time>/firestore.json` + `media.csv` (gitignored, private) |
| `pnpm tick:dry` | `GET $TICK_URL/api/tick?dry=1` and print what the tick would do |
| `pnpm reset:dry` / `pnpm reset` | wipe all data except the owner's `users` doc (owner = first email in `ALLOWED_EMAILS`); dry run by default |
| `node scripts/inspect-system-messages.mjs [limit]` | read-only: counts the latest 500 messages per type, kind and field set (never prints text); for diagnosing chat rendering |
| `pnpm icons` | regenerate PWA icons, the badge and the four shortcut icons (`shortcut-{chat,ping,word,pet}-96.png`) from inline SVG |
| `pnpm words:definitions` | rebuild `public/words/{a..z}.json` from WordNet 3.1 (`wordnet-db`, devDependency) + `src/content/word-definitions-manual.json`; prints coverage (WordNet vs manual), the largest file and any word still missing (exit 2). Run only when `words-answers.json` changes, or to override a bad WordNet sense by adding the word to the manual file; commit the output |

## Deploying

1. `pnpm typecheck && pnpm lint` (and `pnpm build` for anything touching config, the worker or dependencies).
2. Commit, `git push` → Vercel builds `main` automatically. `vercel.json` pins the function region to Singapore (`"regions": ["sin1"]`, the one region Hobby allows), next to the Realtime Database; it overrides the dashboard's Settings → Functions value, so changing the region is a commit, not a console click.
3. If `rules/*.tmpl` or `firestore.indexes.json` changed: `pnpm rules:deploy`. The app and rules are deployed separately. A rules change without a deploy shows up as `permission-denied` in the console; a missing composite index as `failed-precondition` ("The query requires an index"); a missing RTDB `.indexOn` as a console warning ("Using an unspecified index…") and the whole node downloaded to the phone. `pnpm test` fails first: `tests/unit/rules-coverage.test.ts` prints the entry to add to `firestore.indexes.json` for any query that needs one, refuses `orderBy(documentId(), "desc")` outright (order ascending over an id range instead), and names the RTDB node that needs `.indexOn` for an `orderByChild` field.
4. If `src/app/sw.ts` or precached assets changed, the new worker installs on the next launch or hourly check and *waits*: each phone shows the persistent "Update available · Reload" toast (or More → Check for updates says so) and the tap hands over and reloads once. Nothing updates silently mid-session; a closed-and-reopened app activates the waiting worker on its own. A hard refresh or reinstall is never required.
5. Check `/api/health` and the console for CSP reports after a config change.

## CI

`.github/workflows/ci.yml` runs the existing checks on GitHub Actions; nothing in it needs `.env.local` or a secret (the workflow `env` holds obviously fake `NEXT_PUBLIC_*` values, `tincan-ci-fake`, and two `example.com` emails, which `scripts/build-rules.mjs`, `tests/rules.test.ts` and `tests/trivia-live.test.ts` read from `process.env` when no env file exists).

| Job | When | What |
| --- | --- | --- |
| `checks` | every push and pull request | `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm knip`, `pnpm test` (Node from `engines.node`, pnpm from `packageManager`, the pnpm store cached by the lockfile) |
| `rules` | every push and pull request | the same, plus Temurin Java 21 and `firebase-tools`, then `pnpm test:rules` on the emulators; the emulator jars are cached under `~/.cache/firebase/emulators` |
| `e2e` | pushes to `main`, or by hand | Playwright's Chromium (cached under `~/.cache/ms-playwright`, keyed by the lockfile; `--with-deps` on a miss, `install-deps` on a hit), then `pnpm test:e2e` (production build with the placeholder env + Playwright); on failure the HTML report and traces are uploaded as the `playwright-report` artifact. Two YouTube *playback* tests are skipped there (YouTube refuses to play from GitHub's datacenter addresses); loading, cueing, embed URL and player size still run. "Failed to load resource" console errors from Google / Firebase hosts are ignored only when the build's project id ends in `-ci-fake` (`tests/e2e/violations.ts`) |

A new push cancels the run still going on the same branch or PR (`concurrency`). To run the e2e job by hand: GitHub → Actions → CI → "Run workflow" → pick the branch (that is `workflow_dispatch`; it runs all three jobs). The README badge shows the latest `main` result.

## Routine checks

- **Quota**: More → Usage meter on a phone after a normal day. Spark gives 50k reads / 20k writes a day; the app is designed to sit far under that.
- **RTDB connections**: 100 simultaneous on Spark; the app keeps ≤ ~6 per client. If a screen leaks a listener, `useRtdbValue` with a `null` path on unmount is the pattern.
- **Push**: More → Notifications → "Send a test". A failure there means the token, the VAPID key or the service worker registration.
- **Tick**: cron-job.org history should show 200s; `pnpm tick:dry` locally against production to see the plan.
- **Dependencies**: `pnpm outdated`, `pnpm audit --prod`.

## Updating radio stations

**Where things live.** Stream URLs exist in exactly one place: `src/content/radio.json`. Everything else is derived from it through `src/lib/radio.ts`:

- `RADIO_MEDIA_ORIGINS`: every station's URL origin plus its `hosts` → the page CSP's `media-src` (`csp.ts`).
- `RADIO_HLS_ORIGINS`: the same for `format: "hls"` stations only → `connect-src` (hls.js fetches playlists and segments on browsers without native HLS).
- `RADIO_HOSTNAMES`: every host above → the service worker skips them before Serwist sees the request (`src/app/sw.ts`), so streams are never intercepted or cached.

Never hand-edit a stream host into `csp.ts` or `sw.ts`, and never use a wildcard such as `*.cloudfront.net`. If a stream redirects or serves segments from another host, list that host in the station's `hosts` array.

A station entry:

```json
{
  "id": "air-telugu",
  "name": "AIR Telugu · Hyderabad",
  "genre": "Akashvani Telangana",
  "region": "India",
  "language": "Telugu",
  "format": "hls",
  "url": "https://radio.wavespb.com/live/1c701f7b70df2568/1c701f7b70df2568.m3u8",
  "hosts": ["d1cvqgmbcpg5yn.cloudfront.net"],
  "attribution": "All India Radio / Prasar Bharati",
  "verified": true
}
```

Keep `id` when you only replace the URL of the same channel: the shared `radio/main` node and each person's last-played station (localStorage `tincan.radio.last.<uid>`) refer to it. Use a new `id` for a different channel.

### Finding a station's current official URL

Indian stations use only the official Prasar Bharati streams that the All India Radio web player loads. Don't use commercial FM stations or mirror sites.

1. The channel ids are on `https://akashvani.gov.in/` (each station tile has a `data-link="<id>"`). The ids in use are Vividh Bharati `1`, FM Gold Delhi `2`, FM Rainbow Delhi `3`, Raagam `4`, Akashvani Karnataka `115` (our "AIR Kannada") and Akashvani Telangana `255` (our "AIR Telugu"). Alternatives: VB Kannada `118`, VB Telugu Hyderabad `257`, Akashvani Andhra Pradesh `49`.
2. Open the player at `https://akashvani.gov.in/radio/live.php?channel=<id>`. The page source holds the whole channel table (`var channels = { '<id>': { name, live_url, … } }`), so one fetch gives every URL:

   ```bash
   curl -sL "https://akashvani.gov.in/radio/live.php?channel=1" \
     | python3 -c "import re,sys; s=sys.stdin.read(); [print(i, n, u) for i, n, u in re.findall(r\"'(\d+)'\s*:\s*\{\s*name:\s*'([^']*)'.*?live_url:\s*'([^']*)'\", s, re.S)]" \
     | grep -iE "^(1|2|3|4|115|255|118|257) "
   ```

3. Check the URL before using it:

   ```bash
   U=<live_url>
   curl -sI "$U" | grep -iE "^HTTP|content-type|access-control-allow-origin"   # 200 (or 302) and application/vnd.apple.mpegurl
   curl -s -o /dev/null -w "%{redirect_url}\n" "$U"                          # radio.wavespb.com redirects: put that host in "hosts"
   curl -sL "$U"                                                             # the playlist; follow a variant and fetch one segment
   ```

   A segment should come back as `audio/aac` or `video/mp2t`. `radio.wavespb.com` (Prasar Bharati's WAVES) redirects each stream to a fixed CloudFront host, and that host must be listed in `hosts`. The `d3r9rhourdc02u.cloudfront.net` streams serve their variants and segments from the same host.

**CORS.** The `d3r9rhourdc02u.cloudfront.net` stations (FM Gold, FM Rainbow, Raagam, AIR Kannada) send no `Access-Control-Allow-Origin` header. They play only where the browser has native HLS (Android Chrome, so the installed app on both phones). On a desktop browser hls.js can't read them, and the screen says "This station only plays in the mobile app". The `radio.wavespb.com` stations send `*` and play everywhere.

### Swapping a station

Example: replacing "AIR Kannada" (Akashvani Karnataka) with Vividh Bharati's Kannada channel.

1. Find the URL (channel `118` above). Today it is `https://d3r9rhourdc02u.cloudfront.net/assets/radio/airbang03/air035_Auto.m3u8`, on a host already in the CSP, so no `hosts` entry is needed.
2. In `src/content/radio.json`, change that entry's `url`, `name` (e.g. "Vividh Bharati · Kannada") and `genre`. Use a new `id` such as `air-vb-kannada`, since it's a different channel.
3. In `tests/unit/radio.test.ts`, update the expected id list. If the host changed, also update the official-host pattern there and the `air` host list in `tests/unit/csp.test.ts`.

For Telugu, Vividh Bharati Telugu (`257`) is `https://radio.wavespb.com/live/89969ad91f106dde/89969ad91f106dde.m3u8`. It currently redirects to `d1tmej9eu7kw5c.cloudfront.net`, so it needs `"hosts": ["d1tmej9eu7kw5c.cloudfront.net"]` (that host is already allowed through Vividh Bharati). Re-check the redirect with the `curl -w` line above when you make the change.

### After any change

1. `pnpm vitest run tests/unit/csp.test.ts tests/unit/radio.test.ts` (the CSP unit test checks the radio hosts in media-src and connect-src, and that no wildcard appears), then `pnpm typecheck && pnpm lint && pnpm test`.
2. Add a CHANGELOG line. If a new organisation or host now receives listeners' IPs, update the README's privacy table.
3. Commit and push. Vercel redeploys; on each phone reopen the app (or More → Check for updates) and tap Reload on "Update available".
4. On a phone, play the station and check that the other phone follows. Then open More → Diagnostics (owner account) and confirm there's no `[csp]` line for the stream hosts.


## Correcting a festival date

`src/content/festivals.json` is only the *import source* for Memories → Milestones → "Add festivals". Once imported, each festival is an ordinary milestone document, so a wrong date is fixed in the app: Memories → Milestones → pencil on the festival → change the date → Save. Both phones see the change (the summary on `pair/main` is re-mirrored). Entries marked `verify` in the seed (lunar-calendar dates for 2027–2028, and Eid 2026) import with the flag: the row shows "⚠️ check the date" with a "Looks right ✓" button, and 7 days before the date both phones get "Is this date right?" linking straight to the editor. Editing the date or tapping "Looks right" clears the flag. Editing the seed file afterwards does nothing to milestones already imported; "Add festivals" skips anything already present by title + date (yearly items by title + month-day), so a corrected seed only matters for a fresh import — delete the wrong milestone first if you want the seed's new date instead of editing.

## Backups

Spark has **no managed Firestore exports**, so `pnpm export` is the only backup. It writes every collection, plus the `private` and `items` subcollections, with tagged timestamps, and a CSV of every media URL. The signed URLs in the CSV open the originals, so keep the folder somewhere private. Cloudinary keeps the media itself. Run it before risky changes and every few weeks.

## Resetting data

`pnpm reset:dry` prints what would be deleted (all Firestore collections, all RTDB nodes, every `users` doc but the owner's, and the Cloudinary folders). `pnpm reset` does it. Both users must then sign in again; the second sign-in re-forms the pair.

## Changing the pair

Edit `ALLOWED_EMAILS` locally and on Vercel → `pnpm rules:deploy` → redeploy Vercel → if a uid is being replaced, `pnpm reset` (the `uids` array on `pair/main` can only grow, by design).
