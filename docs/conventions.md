# Conventions

## Files

- `src/app/**` pages are thin: a `page.tsx` renders one screen component and nothing else. Shared layout and providers live in `src/app/(app)/layout.tsx`.
- `src/components/<area>/*` screen and card components. `src/components/ui/*` is the small design kit (Card, Button, Input, Switch, Avatar, Skeleton, Spinner).
- `src/lib/db/*` Firestore/RTDB access per collection (refs, queries, writes, transactions). `src/lib/*` pure helpers. `src/hooks/*` React hooks. `src/content/*` static decks and SVG sets.
- `src/lib/server/*` and `src/lib/firebase/admin.ts` are server-only (`import "server-only"`). Nothing client-side imports them.
- Path alias `@/` → `src/`.

## Firebase access

- Client Firestore imports come from `@/lib/firebase/fs` (metered), never from `firebase/firestore` directly. RTDB helpers from `@/lib/rtdb`; the RTDB SDK is imported directly where needed.
- Every Firestore query is bounded: a single doc, or `limit(n)`. Pagination through `usePagedCollection`. Equality filters + one orderBy only (no composite indexes).
- Timestamps are `serverTimestamp()`; documents also carry `…Ms` numbers derived client-side only for rendering. Day keys use `dateKeyIn` / `roomDateKey` / `ownDateKey` from `lib/dates`.
- RTDB listeners attach in the screen that needs them and detach on unmount; app-wide listeners live only in `LiveEventsProvider` and `PresenceController`.
- Shared state updated by both users (game boards, pet timestamps, pixel grid, counters) goes through transactions.

## React & lint

ESLint runs the React Compiler rules. The patterns that fail lint and how we write them:

| Don't | Do |
| --- | --- |
| `setState` directly in an effect body | derive during render, or compute in the event handler, or use `useSyncExternalStore` / a subscription callback |
| read `ref.current` or `Date.now()` during render | `useNow()` hook for time; read refs in handlers/effects |
| `useMemo`/`useCallback` with incomplete deps | list every dep; the compiler checks them |
| conditional hooks | early-return *after* hooks |

Other habits: `"use client"` on any file using hooks; `cn()` from `lib/cn` for class merging; `framer-motion` for motion, with multi-keyframe animations as tweens (springs allow two frames only); icons from `lucide-react`; `next/image` with `unoptimized` for Cloudinary/GIPHY URLs.

## Design tokens

Theme colours are CSS variables on `:root` (`--bg`, `--surface`, `--surface-2`, `--border`, `--muted`, `--accent`, `--accent-soft`, …) with light/dark values; Tailwind utilities map to them (`bg-surface`, `text-muted`, `bg-accent-soft`). Each tab sets its own `--accent`. Cards are `rounded-[20px]`; tap targets ≥ 44 px; every icon-only button has `aria-label`.

## Validation & types

Shapes live in `src/lib/types.ts` (`UserDoc`, `PairDoc`, `Message`, …). API bodies are zod `.strict()`. Rules mirror the same bounds, so changing a limit means changing the type, the zod schema, the rule template and the UI copy together.

## Git

- Work on `main`. One commit per phase or fix, message `area: what changed` (`chat: …`, `rules: …`, `phase N: …`). Commits end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- `pnpm typecheck` and `pnpm lint` green before committing; `git push` after every commit.
- Each commit that changes behaviour also updates `docs/*` and `CHANGELOG.md` (see adding-a-feature.md → "Finish").
- Never commit `.env*` (except `.env.example`), `firestore.rules`, `database.rules.json`, `.firebaserc`. Leave `AGENTS.md` alone (Next rewrites it).
