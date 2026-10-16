# Adding a feature

The checklist below is the order that has worked for every phase so far. Skip steps that don't apply, but do read the "Finish" section every time.

## 0. Decide where it lives

- **Persistent?** → Firestore collection (bounded reads). **Updated more than a few times a minute or ephemeral?** → RTDB node, listener attached only on that screen.
- **Does Home need it?** Home may read only the six fixed docs. Mirror a small summary onto `pair/main` from the writer instead of adding a listener.
- **Does the friend need to know right now?** Toast through `LiveEventsProvider` if they're in the app; push through `notify()` otherwise. Both, if a game turn.

## 1. Types and content

- Add/extend the doc type in `src/lib/types.ts`.
- Static content goes in `src/content/*.json` and is imported only by the screen that uses it.

## 2. Data access

- New file `src/lib/db/<thing>.ts`: ref helpers, bounded queries, write functions using `serverTimestamp()`, transactions for shared state. Import Firestore from `@/lib/firebase/fs`.
- For paginated lists use `usePagedCollection`; for a single RTDB node `useRtdbValue(path | null)`.

## 3. Rules

- Edit `rules/firestore.rules.tmpl` or `rules/database.rules.json.tmpl`: who may create/update/delete, which fields, size limits, `createdAt == request.time` on create, own-key constraints for maps keyed by uid.
- Add a test in `tests/rules.test.ts` for the allow and the deny case.
- `pnpm rules:build` to check the template compiles; the owner runs `pnpm rules:deploy` (say so in the summary).

## 4. UI

- Screen component in `src/components/<area>/`; a thin `page.tsx` under `src/app/(app)/…`. Add a row to the hub (PlayScreen / MemoriesHub / PlanScreen / MoreScreen) and, if needed, a Home card.
- Use the ui kit, `cn()`, Framer Motion, friendly empty state, `aria-label`s, ≥ 44 px targets. Heavy libraries (Leaflet, YouTube, canvases) load lazily (`next/dynamic`, see `play/together/lazy.tsx`).
- Keep per-screen Firestore reads to what the screen shows; check More → Usage after using it.

## 5. Realtime & notifications

- **New push type**: add to `PUSH_TYPES`, `TOGGLE_FOR` and `composePush` in `src/lib/pushTypes.ts`; if it needs a new toggle, add the key to `NOTIF_KEYS` + `NOTIF_LABELS` in `types.ts` (NotificationsCard renders from that list). Send with `notify(type, payload)` on the client or `sendPushTo` from the tick.
- **New live toast**: subscribe in `LiveEventsProvider` (bounded, single node/doc) and `toast()` from there, not from the screen.
- **New scheduled job**: a function in `src/app/api/tick/route.ts` wrapped in `once(ctx, job, key, …)`, with a `dry` branch; verify with `pnpm tick:dry`.

## 6. Server route (rare)

Only when the client can't do it safely (secrets, cross-user writes). Create `src/app/api/<name>/route.ts`, add a `RouteKey` and bucket in `guard.ts`, validate with `.strict()` zod, call through `authedFetch`. Document it in docs/api.md.

## 7. Garden sticker (optional)

Add the `GardenEvent` id and sticker to `src/content/garden/index.tsx`, then call `recordTogetherEvent("<id>", uid)` at the moment of completion.

## 8. New board game

Implement `Engine<S, M>` in `src/lib/games/<game>.ts`, register in `lib/games/index.ts` and `GAME_META`/`GAME_TYPES`, add a board component under `components/play/boards/`, and extend the `type` enum in the RTDB rule for `games`. Results and head-to-head are generic.

## 9. How-to (games and slow features)

Add an entry to `src/content/howto.ts` (title, label ≤ 40 chars, 3–4 steps starting with an emoji, optional tip) and pass `help="<key>"` to the screen's `SubHeader`. If it has a Play tile, use `HOWTO.<key>.label` as its badge. `tests/unit/howto.test.ts` checks the shape.

## Finish

1. `pnpm typecheck && pnpm lint` green (`pnpm build` too if config/worker/deps changed).
2. **Update the docs in the same commit**: the relevant `docs/*.md` page(s) (features, data-model, api, security, operations as applicable) and a `CHANGELOG.md` entry under the current date. If a convention changed, update `docs/conventions.md`; if the spec changed, update `CLAUDE.md`.
3. Commit (`area: what changed`), push.
4. Report: what was built, what was skipped, and what the owner must do manually (rules deploy, console settings, env on Vercel).
