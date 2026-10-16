# Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `permission-denied` in console after a change | rules template changed but not deployed, or the client writes a field the rule doesn't allow | `pnpm rules:deploy`; compare the write with `rules/*.tmpl`; add the field to the allowed keys |
| `permission_denied` from RTDB on a game move | transaction rewrote a node including the opponent's field | the `games` rule allows an unchanged opponent `reaction`; any new per-user field needs the same treatment |
| Sign-in loops to the sign-in page | email not in `ALLOWED_EMAILS` on Vercel, or `/api/gate` 500 because `FIREBASE_SERVICE_ACCOUNT` is wrong | check `/api/health` booleans; re-base64 the service account on one line |
| `ERR_REQUIRE_ESM` / jose crash on Vercel | firebase-admin's jwks-rsa requiring jose v6 | keep the `pnpm.overrides.jose = 5.10.0` in package.json |
| Build fails on Vercel with Node error | Node < 22 | `engines.node: 22.x` is pinned; check the project's Node setting |
| Push test says sent but nothing arrives | notifications blocked at OS level, worker not registered (dev mode), or stale token | production build only; More → Notifications → re-enable; tokens auto-prune on failure |
| Push arrives but tapping opens nothing | notification URL not same-origin | `sw.ts` only opens same-origin URLs by design; check `composePush` `url` |
| GIF button missing | `NEXT_PUBLIC_GIPHY_API_KEY` absent, or set as a Sensitive variable on Vercel | add it as a plain variable; redeploy |
| GIPHY 429 | free key rate limit | the panel debounces 500 ms and caches trending; wait |
| Image "Photo unavailable" | URL not under `res.cloudinary.com/<cloud>/` | `lib/safeUrl.ts` blocks it; check the cloud name env |
| Upload fails with signature error | preset not in Signed mode, or clock skew | switch preset to Signed in the Cloudinary console; retry |
| Lint: "Calling setState in an effect" / "ref during render" | React Compiler rules | see docs/conventions.md → React & lint |
| `pnpm test:rules` can't start emulators | Java missing | `brew install --cask temurin` |
| `pnpm rules:build` warns about one email | `ALLOWED_EMAILS` has one entry | fine for solo testing; add the second before the friend signs in |
| Daily history empty / index error | ordering by `__name__` descending | queries order by the `dateKey` field (auto-indexed); never add composite indexes |
| Usage meter shows a spike | an unbounded listener or a screen re-subscribing per render | find the screen; every query needs `limit` or a single doc |
| CSP violation in console (request blocked) | a new origin (CDN, stream URL) | add it to the matching directive in `next.config.ts`; to unblock users meanwhile set `CSP_REPORT_ONLY=1` on Vercel and redeploy |
| Animations missing or `motion` import warning | a component imported `motion` instead of `m` | use `m.*`; features come from `<LazyMotion>` in Providers |
| Chat background not showing | `chatBg` rejected by rules (photo not from our cloud or unknown key) | check `rules/firestore.rules.tmpl` → `chatBgOk()`; deploy rules |
| `pnpm profile:chat` fails to start a worker | jsdom needs Node 22 | the config uses happy-dom; keep it |
| Tick does nothing | wrong `x-tick-secret`, or the 15-minute window already passed and `tickLog` has the key | `pnpm tick:dry`; delete the `tickLog` doc to re-run a job |
| Home countdown shows a trip not the meetup | `pair.nextMeetup` empty → nearest trip is the fallback | set the next meetup in More |
