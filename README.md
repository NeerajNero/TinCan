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
| `pnpm cloudinary:presets` | Creates/updates the two unsigned Cloudinary upload presets from your env (one-time) |
| `pnpm rules:build`  | Fills `rules/*.tmpl` with `ALLOWED_EMAILS` → `firestore.rules`, `database.rules.json`, `.firebaserc` |
| `pnpm rules:deploy` | `rules:build`, then `firebase deploy --only firestore:rules,database` |

## Security rules

The rule sources are `rules/firestore.rules.tmpl` and `rules/database.rules.json.tmpl`.
`__ALLOWED_EMAILS__` is filled from `ALLOWED_EMAILS` (`.env.local`, falling back to `.env`)
by `scripts/build-rules.mjs`; the generated `firestore.rules`, `database.rules.json` and
`.firebaserc` are gitignored because they contain the two emails and the project id.
Access requires a verified Google email on that list — keep it in sync with `ALLOWED_EMAILS`
and rerun `pnpm rules:deploy` whenever it changes.

One-time setup for deploying rules:

```bash
npm i -g firebase-tools   # the CLI isn't a project dependency
firebase login
pnpm rules:deploy
```

Firestore (native mode) and the Realtime Database must already be created in the Firebase
console; the CLI only uploads rules.
