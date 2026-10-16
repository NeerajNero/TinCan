# Testing

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
