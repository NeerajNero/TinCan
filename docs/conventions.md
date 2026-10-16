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

Other habits: `"use client"` on any file using hooks; `cn()` from `lib/cn` for class merging; framer-motion through `m.*` only (`import { m } from "framer-motion"`; `<LazyMotion>` in Providers supplies the features, so a bare `motion.` import would double the animation runtime), multi-keyframe animations as tweens (springs allow two frames only); icons from `lucide-react`; Cloudinary media through `components/ui/CloudImage` / `variantUrl()` from stored `variants` only (never build a transformation URL: assets are authenticated), every other image a plain `<img>` with an eslint-disable note. `next/image` is never used with remote sources.

TypeScript runs `strict` + `noUncheckedIndexedAccess`: index reads are `T | undefined`, so narrow (`?? fallback`, early return) rather than assert; `!` only where the index is provably in range (modulo into a static non-empty list, a permutation of the same length). ESLint also errors on `any`, incomplete hook deps and import order (`eslint --fix` sorts them: builtin, external, `@/`, relative, alphabetised, blank line between groups). `pnpm knip` must be clean: don't export what only one file uses.

Errors: fire-and-forget promises end in `.catch(swallow)`; anything shown to the user goes through `errorMessage(err, fallback)` (both in `lib/swallow.ts`). Toasts come from `useToast()`; there is no second toast or error path.

## Overlays and scrolling

- Bottom sheets and menus: `<Sheet open onClose label className>` from `components/ui/Sheet`. It portals to `<body>`, adds the scrim, the drag handle, Escape-to-close and the safe-area bottom padding, and mounts children only while open. `className` styles the content column (include horizontal padding, default `px-4`); `tone`, `height`, `maxHeight`, `scroll` cover the chat drawer case. For a `T | null`-driven menu use `useStickyValue` so the content stays during the exit animation.
- Any other fixed overlay (viewer, ping overlay, confetti, floating buttons) is wrapped in `<Portal>` and takes its z-index from `Z`. Never rely on `position: fixed` inside a screen: the chat header's `backdrop-blur`, the tab transition's transform and similar make an ancestor the containing block.
- The document is locked. New full-screen pages outside the shell use `screen-fixed` (and `justify-center-safe` if centred, so tall content isn't cut off at the top). Inside the shell, never use `h-dvh`/`min-h-dvh`; fill with `flex-1 min-h-0`.
- Focus programmatically with `focusNoScroll(el)` and on mount with `ref={autoFocusRef}`; `Input`'s `autoFocus` already does this.

## Design tokens

Theme colours are CSS variables on `:root` (`--bg`, `--surface`, `--surface-2`, `--border`, `--muted`, `--accent`, `--accent-soft`, …) with light/dark values; Tailwind utilities map to them (`bg-surface`, `text-muted`, `bg-accent-soft`). Each tab sets its own `--accent`. Cards are `rounded-[20px]`; tap targets ≥ 44 px; every icon-only button has `aria-label`.

## Validation & types

Shapes live in `src/lib/types.ts` (`UserDoc`, `PairDoc`, `Message`, …). API bodies are zod `.strict()`. Rules mirror the same bounds, so changing a limit means changing the type, the zod schema, the rule template and the UI copy together.

## Git

- Work on `main`. One commit per phase or fix, message `area: what changed` (`chat: …`, `rules: …`, `phase N: …`). Commits end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- `pnpm typecheck` and `pnpm lint` green before committing; `git push` after every commit.
- Each commit that changes behaviour also updates `docs/*` and `CHANGELOG.md` (see adding-a-feature.md → "Finish").
- Never commit `.env*` (except `.env.example`), `firestore.rules`, `database.rules.json`, `.firebaserc`. Leave `AGENTS.md` alone (Next rewrites it).
