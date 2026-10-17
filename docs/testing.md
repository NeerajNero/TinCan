# Testing

## Unit tests (`pnpm test`)

Vitest over the pure modules in `tests/unit` (`.tsx` tests opt into happy-dom with `// @vitest-environment happy-dom`): Recent games rendered with every catalogue type, cancelled/abandoned/draw rows and an unknown type; the catalogue's safe fallback; game engines against known positions (checkers mandatory capture, multi-jump and crowning; chess promotion, fool's-mate checkmate and stalemate; Connect Four diagonal win and draw; tic-tac-toe lines), `dateKey` roll-over at ROOM_TZ midnight and streak transitions (`lib/streak.ts`), pet stat derivation and levels, pet life helpers (`lib/petLife.ts`: no-repeat reactions, tap bursts, particle cap, petting top-up and its `sinceFor` round-trip, friend-vs-own change detection), call-time overlap across zones including a slot that crosses midnight after conversion, the ping cooldown (`lib/pings.ts`), the Firestore offline counter reducer (`lib/firestoreHealth.ts`), the YouTube loader (once, wraps an existing handler, reuses a tag), error texts and the drift plan (`lib/playerSync.ts`) the CSP builders (probe image path-limited in both policies, RTDB long-polling hosts), system lines (`SystemPill` for every kind, the legacy text-only shape and an unknown kind; `MessageList` with a backdrop renders no empty row, shows no unread divider for system lines and keeps the scroller `relative`), playlist helpers (dedupe, undo index, 50 cap, remove, move), the room-chat trim, text and unread helpers, and radio (`tests/unit/radio.test.ts`: the six AIR channels on official hosts, native vs hls.js choice, worker bypass hosts; the CSP test checks media-src/connect-src radio hosts). Keep logic that needs testing in `src/lib` with no Firebase import so it stays testable.

## Smoke tests (`pnpm test:e2e`)

`tests/e2e/youtube.spec.ts` opens the test-only `/e2e/youtube` harness (served only with `E2E_HARNESS=1`, which `playwright.config.ts` sets) with YouTube's sample video `M7lc1UVf-VE`. It asserts that `onReady` fires and the video is cued when the id arrives at mount and 1.5 s later, the way the RTDB value does. It also checks that Play, Seek and Pause taps change the player state, and that Listen's covered player is at least 200×200 and plays. It needs network access to YouTube.

`tests/e2e/pet.spec.ts` opens the test-only `/e2e/pet` harness (`components/dev/PetHarness.tsx`, same `E2E_HARNESS=1` gate): the real `PetStage` and `usePetMotion` with a local pet doc, buttons that simulate the friend, and every write/toast logged to `window.__pet`. It checks that Feed disables the buttons and writes after the chomps (1–1.9 s), that Tuck in / Wake write only after ~1.4 s, that 24 rapid taps never show more than 20 particles, that a long-press writes once on release with a higher value, that the friend's feed replays with a toast and no write, the level badge, the Home size (no particles) and reduced motion (immediate write, no particles).

`tests/e2e/violations.ts` is the shared error collector for the harness specs (`collectErrors(page, counts?)`: page errors plus console errors, CSP and Permissions-Policy violations included; the spec asserts the list is empty). It ignores exactly two third-party messages and logs each as `[e2e] ignored third-party noise (…)`: the CSP refusal of Google sign-in's `https://apis.google.com/js/gen_204` beacon, and `Permissions policy violation: compute-pressure …` when its source is a `www.youtube.com` / `www.youtube-nocookie.com` document. The CSP and Permissions-Policy themselves are unchanged. `tests/e2e/violations.spec.ts` proves both are really raised and ignored (a stubbed youtube-nocookie frame calls the Compute Pressure API; the page fetches gen_204) and that look-alikes (another apis.google.com path, compute-pressure from our origin or a spoofed host, another feature from YouTube) still count. Add any future exception there, with its own self-check.

`tests/e2e/csp.spec.ts` checks that `/signin` is served with an enforced, nonce-based CSP with no `'unsafe-inline'` in script-src. It then waits for the service worker to control the page, requests an image from every host the worker caches plus Firestore's probe image (`www.google.com/images/cleardot.gif`), and fails on any `securitypolicyviolation` in the page or inside the worker. A self-check proves both listeners fire on a deliberate violation.

`tests/e2e/layout.spec.ts`: Playwright on a Pixel 7 viewport against a production build (`next build` then `next start -p 3100`; no sign-in needed). For `/signin` and `/offline` it asserts `document.documentElement.scrollHeight` equals the viewport height, both as shipped and with the html/body clamp lifted (the clamp alone would only clip a too-tall screen), at full height and at a 200 px-tall viewport, and that `window.scrollTo` can't move the page. First run needs `npx playwright install chromium`. There is no CI pipeline in the repo yet; run it before pushing layout changes.

## Profiling the chat list (`pnpm profile:chat`)

`tests/perf/chat.profile.test.tsx` mounts `MessageList` with 300 messages under React's `<Profiler>` in happy-dom and appends ten more, printing the mount cost and the median append commit. It asserts an append costs under a quarter of the mount (the memoised bubbles must not re-render). Numbers are an upper bound: happy-dom is slower than a phone's Chrome. Windowing (`@tanstack/react-virtual`) is only worth adding if an append exceeds ~16 ms in a real browser.

## Automated: security rules

`tests/rules.test.ts` runs against the Firebase emulators with `@firebase/rules-unit-testing` and vitest. It reads `ALLOWED_EMAILS` and `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` from `.env.local` / `.env` so the generated rules match.

```bash
brew install --cask temurin   # Java, once (the emulators need it)
pnpm test:rules               # = rules:build + emulators:exec + vitest
```

The emulators write `firestore-debug.log` and `database-debug.log` into the repo root; they are gitignored.

Covers: allowlist deny, message create/update constraints and Cloudinary URL prefix, capsule and envelope private bodies, gifts-list privacy, `pair.uids` immutability, RTDB pings ownership and presence validation. Add a case for every rule you touch (allow + deny).

## Static

`pnpm typecheck` (Next typegen + tsc) and `pnpm lint` (Next + TypeScript + React Compiler rules). Both must pass before a commit. `pnpm build` catches worker/config regressions and prints the route bundle sizes.

## Manual checklist (two phones or a phone + desktop, two accounts)

**Presence & Home**: online dot flips within a few seconds; background → "last seen"; weather + distance render; ping animates on both ends, vibrates receiver, shows a toast off-Home; lamp glows 10 min; mood and daily question reveal the friend's answer only after yours; check-in increments the streak the next room-day.

**Chat**: send text → ✓ → ✓✓ → blue when the friend has the chat visible; typing indicator; swipe to reply; long-press menu (react, edit within 15 min, delete for me/everyone); image and voice send, show progress, open full-screen / play at 1.5×; offline send shows a clock then sends; unread badge on the tab; "load older" paginates.

**Push**: More → Notifications → master on → test push arrives with the app closed; message push is suppressed while the chat is open; tapping opens the right screen.

**Play**: invite → friend gets "your turn" push and Home card; moves sync; resign/cancel paths; result shows in the record strip; deck card flips for both; trivia live and async; wordle compares after both finish.

**Together**: whiteboard strokes and cursors sync; snapshot lands in chat; watch/listen stay within 2 s; radio play/pause syncs; timer chimes; cook steps tick for both.

**Memories / Plan**: photo upload → grid and map pin; capsule body hidden until unlock; envelope opens once; jar draw; milestones and trips mirror to Home; call-time overlap shows in both tz; lists reorder.

**Tick**: `pnpm tick:dry` against production shows sensible actions; cron-job.org history is 200s.

**PWA**: install from Chrome menu on Android; offline page appears with the network off; worker updates after a deploy without reinstall.
