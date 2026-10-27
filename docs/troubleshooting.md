# Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `permission-denied` in console after a change | rules template changed but not deployed, or the client writes a field the rule doesn't allow | `pnpm rules:deploy`; compare the write with `rules/*.tmpl`; add the field to the allowed keys. Since phase 21 every rejected write and denied listener is a `[write]` / `[read]` line in More → Diagnostics (and a toast in dev) with the op, path and code |
| `failed-precondition` / "The query requires an index" in Diagnostics or the console | a Firestore query whose filter + order combination has no composite index, or one ordering by document id descending (`__name__ DESC`) | `pnpm test` names the query and prints the `firestore.indexes.json` entry; prefer rewriting it (see `docs/adding-a-feature.md` → Rules), else add the entry and `pnpm rules:deploy`. Phase 22's daily-word history did this until it became an ascending id range |
| A screen sits on "Connecting…" / "Loading…" forever on both phones | an RTDB listener on a path the rules don't know: the SDK drops a denied subscription silently when no cancel callback is given | check Diagnostics for `[read] onValue <path> → PERMISSION_DENIED`; add the node to `rules/database.rules.json.tmpl` and deploy. The live trivia duel did this until phase 21 (no `trivia` node). Live trivia itself now offers "Play async instead" after 10 s |
| Invite card's Join does nothing / goes to the wrong place | the stored `meta.route` failed `parseInviteMeta` (the card then renders as a plain pill) or the round is over ("Ended") | routes must be same-origin paths ≤ 100 chars; see `lib/invites.ts` and the rules on `messages` meta |
| `permission_denied` from RTDB on a game move | transaction rewrote a node including the opponent's field | the `games` rule allows an unchanged opponent `reaction`; any new per-user field needs the same treatment |
| Sign-in loops to the sign-in page | email not in `ALLOWED_EMAILS` on Vercel, or `/api/gate` 500 because `FIREBASE_SERVICE_ACCOUNT` is wrong | check `/api/health` booleans; re-base64 the service account on one line |
| `ERR_REQUIRE_ESM` / jose crash on Vercel | firebase-admin's jwks-rsa requiring jose v6 | keep the `pnpm.overrides.jose = 5.10.0` in package.json |
| Build fails on Vercel with Node error | Node < 22 | `engines.node: 22.x` is pinned; check the project's Node setting |
| Push test says sent but nothing arrives | notifications blocked at OS level, worker not registered (dev mode), or stale token | production build only; More → Notifications → re-enable; tokens auto-prune on failure |
| Push arrives but tapping opens nothing | notification URL not same-origin | `sw.ts` only opens same-origin URLs by design; check `composePush` `url` |
| GIPHY 429 | free key rate limit | the panel debounces 500 ms and caches trending; wait |
| Photos show 🚫 or 401 in the network tab | the doc has no signed `variants` and the asset is authenticated | run `pnpm migrate-media` (dry run) and then `--yes` |
| Upload fails right after Cloudinary accepts it | `/api/media/urls` failed (secret missing, rate limit) | check `/api/health`; retry |
| GIF tab missing | `GIPHY_API_KEY` not set on the server | add it on Vercel (server-only) and redeploy |
| Image "Photo unavailable" | URL not under `res.cloudinary.com/<cloud>/` | `lib/safeUrl.ts` blocks it; check the cloud name env |
| Upload fails with signature error | preset not in Signed mode, or clock skew | switch preset to Signed in the Cloudinary console; retry |
| Lint: "Calling setState in an effect" / "ref during render" | React Compiler rules | see docs/conventions.md → React & lint |
| `pnpm test:rules` can't start emulators | Java missing | `brew install --cask temurin` |
| `pnpm rules:build` warns about one email | `ALLOWED_EMAILS` has one entry | fine for solo testing; add the second before the friend signs in |
| Daily history empty / index error | ordering by `__name__` descending | queries order by the `dateKey` field (auto-indexed); never add composite indexes |
| Usage meter shows a spike | an unbounded listener or a screen re-subscribing per render | find the screen; every query needs `limit` or a single doc |
| Offline banner forever on one phone, other devices fine | that device pinned RTDB to long-polling (`firebase:previous_websocket_failure`) and the transport was blocked | fixed in 16b; check More → Diagnostics: "RTDB transport", "RTDB connected" and the error list. Copy diagnostics and share the text |
| Firestore "offline (from cache)" on cellular, WebChannel transport errors, then `img-src` blocked `www.google.com/images/cleardot.gif` | Firestore's connectivity probe was blocked, so it never decided to fall back to long-polling | fixed in 16d (`FIRESTORE_PROBE_IMG` in `csp.ts`); Diagnostics → "Firestore reconnects" shows how often it dropped this session |
| Watch together shows a plain black box, title and state load | before 16e the player was built with the first-render video id, null while `watch/main` loaded, and `new YT.Player` threw "Invalid video id" | fixed in 16e. The player is built only once an id is known. Diagnostics lists `[player]` lines for YouTube error codes |
| Synced play does nothing on the phone until you tap the video | browsers block sound without a tap | tap "Tap to join" once per visit; local Play/Pause drives the player inside the tap. If it persists, check the Permissions-Policy still delegates `autoplay` to YouTube (`buildPermissionsPolicy`) |
| "This video can't be embedded" | YouTube error 101/150: the owner disabled embedding | pick another upload of the same video |
| A deploy doesn't show up on the installed app | the old JS is still running | the app checks on launch and resume and offers "Update available, tap to reload"; Diagnostics shows app build vs worker build |
| CSP violation from `StrategyHandler` (service worker) | the worker fetched a host missing from connect-src | add it to `connectSrc()` in `csp.ts` (the worker policy shares it) |
| `Cannot read properties of undefined (reading 'emoji')` | a lookup indexed a game catalogue with a stored type it doesn't know | use `gameInfo()` from `lib/games/catalog.ts` |
| CSP violation in console (request blocked) | a new origin (CDN, stream URL) | add it to the matching directive in `csp.ts`; to unblock users meanwhile set `CSP_REPORT_ONLY=1` on Vercel and redeploy |
| Animations missing or `motion` import warning | a component imported `motion` instead of `m` | use `m.*`; features come from `<LazyMotion>` in Providers |
| Chat background not showing | `chatBg` rejected by rules (photo not from our cloud or unknown key) | check `rules/firestore.rules.tmpl` → `chatBgOk()`; deploy rules |
| A sheet or overlay opens in the wrong place (above the header, off-screen) | it's `position: fixed` inside an ancestor with a transform, filter or backdrop-filter | use `Sheet` / `Portal` (renders into `<body>`) |
| The whole UI, tab bar included, scrolls up | something made the document scrollable or focused without `preventScroll` | keep screens in the shell or `screen-fixed`; use `focusNoScroll`; run `pnpm test:e2e` |
| `pnpm profile:chat` fails to start a worker | jsdom needs Node 22 | the config uses happy-dom; keep it |
| Tick does nothing | wrong `x-tick-secret`, or the 15-minute window already passed and `tickLog` has the key | `pnpm tick:dry`; delete the `tickLog` doc to re-run a job |
| Home countdown shows a trip not the meetup | `pair.nextMeetup` empty → nearest trip is the fallback | set the next meetup in More |
| Radio station silent, "Tap to start audio" does nothing, or "only plays in the mobile app" | the stream URL died, moved to a new host (CSP block), or lacks CORS on desktop | see [A radio station stopped playing](#a-radio-station-stopped-playing) below |

## A radio station stopped playing

Stream URLs live only in `src/content/radio.json`. The CSP and the service worker take their host lists from it through `src/lib/radio.ts`, so fixing a station never means editing `csp.ts` or `sw.ts`. The full procedure is in [operations.md → Updating radio stations](operations.md#updating-radio-stations).

**What you see on the phone.** On Android the app plays HLS natively, and any failure, whether a dead URL or a CSP block, looks the same: `play()` fails and the screen shows "Tap to start audio on this device", and tapping it does nothing. On a desktop browser without native HLS (hls.js), a stream that answers with an HTTP error (404, 403…) shows "This browser can't play this station — try it on your phone". A request that gets no response at all shows "This station only plays in the mobile app". No response means a stream without CORS headers, or a connect-src block.

**Dead URL or CSP block?**

1. Open More → Diagnostics (owner account). A CSP block leaves a line such as `[csp] media-src blocked https://<host>/…` (native) or `[csp] connect-src blocked https://<host>/…` (hls.js). If one is there, the stream works and our policy refused it, which usually means the stream now redirects to a new host. Find the new host (`curl -s -o /dev/null -w "%{redirect_url}\n" <url>`), add it to that station's `hosts` in `radio.json`, and redeploy.
2. No `[csp]` line: test the URL itself.

   ```bash
   curl -sI <url> | grep -iE "^HTTP|content-type"
   ```

   - 404, 403 or a timeout: the URL is dead. Get the current one from the official player (`https://akashvani.gov.in/radio/live.php?channel=<id>`, see operations.md) and replace `url`.
   - 200 with `application/vnd.apple.mpegurl`: the URL is fine. Fetch the playlist (`curl -sL <url>`) and one segment from it; a missing segment means the broadcaster is down, so wait.
3. Plays on the phone but not on a laptop with "only plays in the mobile app": expected for the `d3r9rhourdc02u.cloudfront.net` stations (FM Gold, FM Rainbow, Raagam, AIR Kannada). They send no CORS headers, so only native HLS on Android can play them.

After a fix, run `pnpm vitest run tests/unit/csp.test.ts tests/unit/radio.test.ts`, push to redeploy, and check playback on a phone (both phones follow, no `[csp]` line in Diagnostics).
