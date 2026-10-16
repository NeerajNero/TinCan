# Changelog

Newest first. Every behaviour change adds a line here in the same commit (see `docs/adding-a-feature.md` → Finish). Dates are commit dates.

## 2026-10-16

- **phase 15b: performance & polish**: per-user chat backgrounds (8 CSS-only built-ins + photo from Memories, picker in the chat header and More; `users.chatBg` + rule); CSP enforced with `CSP_REPORT_ONLY=1` fallback; bundle diet (LazyMotion + `m`, lazy `firebase/messaging`, lazy image compressor, chess.js only on the game screen, `zod/mini` on the client, `@next/bundle-analyzer`; `/chat` initial JS 1833 → 1573 KB raw, 564 → 482 KB gzip); worker runtime caches for Cloudinary/OSM/GIPHY/ytimg and NetworkOnly for Firebase/Google/API; `CloudImage` (srcset 320/640, blur-up, lazy) replaces every `next/image`; `React.memo` bubbles, `PresenceProvider` context, chat profiler harness (`pnpm profile:chat`: append ≈ 15 ms in happy-dom, no windowing needed); cursor/live-stroke throttles at 80 ms with change detection; vitest unit tests (`pnpm test`, 27 tests) for engines, dates/streak, pet, availability, pings; `noUncheckedIndexedAccess`, `no-explicit-any`/`exhaustive-deps`/`import/order` as errors, knip clean (dead helpers removed, unused exports un-exported, `Placeholder` component deleted); shared `swallow`/`errorMessage` helpers; dev-only `useReportWebVitals`.
- **test:rules**: verified green (10 tests) with Java installed; emulator debug logs gitignored; vitest config renamed to `.mts` to silence the CommonJS warning.
- **docs**: `docs/` (architecture, data model, features, API, security, operations, conventions, adding-a-feature, testing, troubleshooting), this changelog, detailed README, and the "docs with every change" rule in `CLAUDE.md`.
- **shell**: pending spinner on the tapped tab, route `loading.tsx` fallback, no exit-wait on tab transitions.
- **phase 15a: security**: shared API guard (revocation-checked tokens, allowlist, 16 KB bodies, strict zod, token bucket, Firestore daily caps in `quota/*`), timing-safe tick secret, signed Cloudinary uploads via `POST /api/media/sign`, media URL allowlist in rules and `lib/safeUrl.ts`, security headers with CSP Report-Only, rule shape/size validation, emulator rules tests (`pnpm test:rules`), same-origin notification clicks, dependency overrides (`jose`, `@grpc/grpc-js`).
- **rules**: a game write may carry the opponent's unchanged reaction (transactions rewrite the node).
- **gifs**: 500 ms search debounce, session-cached trending, friendly 429 message.

## 2026-10-15

- **phase 14: fixes**: ping queue (`pings/{uid}/{pushId}`, missed-ping summary toast, cooldown ring), game `endReason` (win/draw/resign/abandoned/cancelled), `CloseGameMenu`, finished games listed 6 h, tick housekeeping for stale games, assorted UX fixes.
- **phase 13: polish & ship**: animation/sound/confetti pass, empty states, usage meter, Firestore read audit, Lighthouse pass (a11y 100, best practices 100), Vercel deploy, README setup checklist.
- **phase 12: nurture**: shared pet (3 species, levels, feed/play, hunger push, system messages), plant stages + wilt, garden scene with 24 stickers and unlock triggers.
- **chore**: `scripts/reset-data.mjs` (`pnpm reset:dry` / `pnpm reset`).
- **phase 11: together**: whiteboard with shared cursors + snapshot, pixel art, pictionary, watch together, listen together + queue, radio (6 verified streams), focus timer, cook-along, chat drawer.
- **phase 10: play v2**: deck games (WYR, NHIE, truth/dare, conversation cards), 20 Questions, hangout wheel, trivia duel (live + async), know-me quiz, daily word.
- **play**: resign confirm, opponent push + live toast on finish, finished games listed 6 h with Rematch, in-game emoji reactions.
- **phase 9: play v1**: game lobby/invites, tic-tac-toe, connect four, chess, checkers, your-turn push, results + head-to-head record, rematch.
- **phase 8: plan**: countdown hero, call-time finder, four lists (gifts author-private), trips with Home fallback.
- **daily history**: ordered by a `dateKey` field (auto-indexed) instead of document id.
- **phase 7: memories**: photo timeline, memory map (Leaflet/OSM), milestones, mood history, daily-question history.
- **live events**: global toast stack; instant toasts for messages, pings, lamp and daily answers off their screens; push toasts skip live-covered types.
- **phase 6: daily & letters**: daily question, journal, time capsules, open-when envelopes, jar, scheduled messages, `/api/tick` jobs, `pnpm tick:dry`.
- **profile**: custom avatar upload (Cloudinary, face-crop) and a short bio.
- **more**: per-type notification list collapsed behind a Customise row.
- **phase 5b: push**: FCM background handler in the Serwist worker, token registration, `/api/push`, notification toggles, foreground toasts.
- **chat**: deleting overlay for delete-for-everyone; recording replaces the input row.
- **cloudinary**: preset setup script; show Cloudinary's error on failed uploads.
- **phase 5a: media**: images and voice notes via Cloudinary, stickers, optional GIPHY GIFs, `DELETE /api/media`.
- **infra**: pin `jose` 5 via pnpm override (Vercel ESM crash), `/api/health` self-check, Node 22 pinned.
- **chat**: jump-to-latest button, auto-load capped at a few pages then a button, reactions below bubbles, tweened ping animations.
- **phase 4: chat v1**: text messages, pagination, ticks, typing, reactions, reply, edit/delete, day separators, unread badge, offline queue.
- **phase 3: presence & home**: presence/heartbeat/onDisconnect, clocks, distance, weather, pings, lamp, sleep/wake, mood check-in, check-ins + streak + plant.
- **phase 2: identity & rules**: onboarding (nickname, city → Open-Meteo), `users` + `pair/main`, More tab, rules templates + `pnpm rules:deploy`.
- **phase 1: scaffold**: Next.js app, Firebase init, Google sign-in + allowlist gate, app shell, PWA manifest/icons/worker, theme tokens and fonts.
