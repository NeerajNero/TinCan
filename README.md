# Tincan 🥫

A private, installable web app for two long-distance friends. The full spec lives in `CLAUDE.md`.

## Develop

```bash
pnpm install
cp .env.example .env.local   # fill in Firebase, Cloudinary, etc.
pnpm dev
```

## Scripts

| Script              | What it does                                              |
| ------------------- | --------------------------------------------------------- |
| `pnpm dev`          | Next dev server (service worker registration is disabled) |
| `pnpm build`        | Production build, bundles the Serwist worker              |
| `pnpm typecheck`    | `tsc --noEmit`                                            |
| `pnpm lint`         | ESLint                                                    |
| `pnpm icons`        | Regenerates PWA icons from the tin-can SVG                |
| `pnpm rules:deploy` | Deploys Firestore + RTDB rules (arrives in phase 2)       |
