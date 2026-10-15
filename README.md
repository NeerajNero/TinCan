# Tincan 🥫

A private, installable web app for two people who live apart. Chat like WhatsApp, see when the other is awake, send a hug across cities, light a lamp on their shelf, play chess and trivia, draw and watch videos together, keep a shared journal, map, jar and time capsules, plan the next meetup, and raise a pet and a garden between you.

Exactly two users, ever. Everything is private to them. Total running cost: **₹0** (Firebase Spark, Vercel Hobby, Cloudinary free, keyless public APIs).

- **Live**: https://tin-can.vercel.app (install from Chrome's menu on Android)
- **Spec**: [`CLAUDE.md`](CLAUDE.md) — product, data model, rules and the build order
- **Docs**: [`docs/README.md`](docs/README.md) — architecture, data model, features → code, API, security, operations, conventions, how to add a feature, testing, troubleshooting
- **History**: [`CHANGELOG.md`](CHANGELOG.md)

## What's inside

| Tab | Features |
| --- | --- |
| **Home** | friend's presence, local time, weather and distance · 4 pings with haptics · lamp · mood check-in · daily question · streak + plant · pet · meetup countdown · next milestone · open games · sleep/wake |
| **Chat** | single thread with ✓ / ✓✓ / blue ticks, typing, swipe-to-reply, reactions, edit/delete, photos (compressed, pinch-zoom), voice notes (hold to record), GIFs, stickers, scheduled messages, offline queue, day separators, unread badge |
| **Play** | tic-tac-toe, connect four, chess, checkers (live boards, your-turn pushes, head-to-head record) · would-you-rather, never-have-I-ever, truth or dare, conversation cards · 20 Questions · hangout wheel · trivia duel (live or async) · know-me quiz · daily word · **together**: whiteboard with shared cursors, pixel art, pictionary, watch together, listen together + queue, radio, focus timer, cook-along |
| **Memories** | photo timeline · memory map (OpenStreetMap) · milestones · journal · jar · time capsules · open-when envelopes · mood history · daily-question history · garden of unlocked stickers |
| **Plan** | meetup countdown · call-time finder across time zones · bucket / wishlist / gift ideas / to-do · trip planner |
| **More** | profile (nickname, city, avatar, bio) · theme · notification toggles · friends-since, next meetup, pet name · sounds · Firestore usage meter · sign out |

Push notifications (FCM) for messages, pings, lamps, turns, invites, daily answers and nudges, streak risk, capsule unlocks, envelopes, jar notes, scheduled messages, milestones, meetups and a hungry pet. A 15-minute scheduler delivers the time-based ones.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router, Turbopack), TypeScript, Tailwind v4, Framer Motion, lucide icons, Fredoka + Nunito |
| PWA | Serwist service worker (`src/app/sw.ts`) serving the app shell, `/offline`, and the FCM background handler |
| Auth | Firebase Google sign-in gated by a two-email allowlist, enforced in the security rules and on the server |
| Data | Firestore for everything persistent, Realtime Database for everything ephemeral (presence, typing, pings, lamps, cursors, live boards, canvases, watch/listen sync, timers) |
| Media | Cloudinary via signed uploads from the browser; secret only in server routes |
| Server | Next API routes on Vercel (`/api/push`, `/api/media`, `/api/media/sign`, `/api/gate`, `/api/tick`, `/api/health`) with `firebase-admin` |
| Scheduler | cron-job.org → `GET /api/tick` every 15 min (no Vercel crons) |
| Free APIs | Open-Meteo (weather + geocoding), OpenStreetMap tiles via Leaflet, YouTube IFrame Player, public radio streams, GIPHY (optional key) |
| Games | `chess.js`; the other engines are in `src/lib/games` |

Design goals that shape the code: every Firestore listener is bounded, Home subscribes to exactly six documents, anything updated more than a few times a minute lives in RTDB, and More shows a usage meter against the Spark quota. See [`docs/architecture.md`](docs/architecture.md).

## Repository layout

```
src/app/            routes (thin pages), API routes, service worker, serwist handler
src/components/     screens and cards by area (home, chat, play, memories, plan, more, pet, …)
src/hooks/          React hooks (pair, messages, presence, uploads, paged collections, …)
src/lib/            helpers; lib/db = Firestore/RTDB access; lib/server + lib/firebase/admin = server-only
src/content/        static decks, question banks, word lists, radio stations, SVG sprite sets
rules/              firestore.rules.tmpl, database.rules.json.tmpl (emails injected at build time)
scripts/            build-rules, cloudinary-presets, tick-dry, reset-data, icons
tests/              security-rules tests (Firebase emulators + vitest)
docs/               the documentation
```

## Setup from zero

You need a Google account for each of the two people, a Firebase project, a Cloudinary account, a Vercel account and a cron-job.org account. Everything stays on free plans.

### 1. Firebase (Spark plan)

1. Create a project at console.firebase.google.com. Say no to Google Analytics and Gemini features.
2. **Authentication** → Sign-in method → enable **Google**. Under Settings → Authorized domains add your Vercel domain once you have it.
3. **Firestore Database** → Create database, native mode, a region close to you.
4. **Realtime Database** → Create database (locked mode is fine; the rules come from this repo).
5. **Cloud Messaging** → Web Push certificates → Generate key pair → `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
6. Project settings → General → add a **Web app**; copy the config into the `NEXT_PUBLIC_FIREBASE_*` variables.
7. Project settings → Service accounts → Generate new private key. Base64 it on one line: `base64 -i sa.json | tr -d '\n'` → `FIREBASE_SERVICE_ACCOUNT`.
8. Never enable Cloud Functions, Storage or Extensions; the app doesn't use them and they need Blaze.

### 2. Cloudinary (free)

1. Dashboard → cloud name, API key, API secret → `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
2. After the env is filled in, run `pnpm cloudinary:presets` once. It creates `tincan_image` (folder `tincan/images`, incoming transform to 1080 px, auto-low quality) and `tincan_audio` (folder `tincan/audio`, resource type video).
3. In Settings → Upload, switch **both presets to Signed mode**. The app signs every upload through `/api/media/sign`.

### 3. Local env

```bash
pnpm install
cp .env.example .env.local     # fill in everything; ALLOWED_EMAILS = the two Google emails, comma-separated
pnpm rules:deploy              # builds rules from the templates and deploys them (needs: npm i -g firebase-tools && firebase login)
pnpm dev
```

`ALLOWED_EMAILS` is the pairing: the first email is the owner, the second is the friend. Changing it later means rebuilding and redeploying rules. The values live only in `.env*` and on Vercel; never print or commit them.

### 4. Vercel (Hobby)

1. Import the repo. Framework: Next.js. Node 22 is pinned in `package.json`.
2. Add every variable from `.env.example` under Settings → Environment Variables. `NEXT_PUBLIC_APP_URL` is the deployment URL. Add `NEXT_PUBLIC_GIPHY_API_KEY` as a plain (not Sensitive) variable so it reaches the client bundle.
3. Deploy, then open `/api/health`: it reports the Node version, whether each required env key is set, and whether the admin SDK loads.
4. Do **not** add `crons` to `vercel.json`; Hobby crons are daily-only.

### 5. cron-job.org (the scheduler)

Create a job that GETs `https://<your-domain>/api/tick` every 15 minutes with a request header `x-tick-secret: <TICK_SECRET>`. It delivers scheduled messages, the 20:00 daily-question nudge, the 21:00 streak warning, capsule unlocks, 09:00 milestone/meetup reminders, pet-hungry pushes and game housekeeping. `pnpm tick:dry` shows what a tick would do without sending.

### 6. First run

Both people sign in with Google, pick a nickname and city, and the pair is formed. Push notifications are off until each person turns them on in More → Notifications. Install the app from Chrome's menu on Android for the home-screen icon and background pushes.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Next dev server (service worker and push are disabled in dev) |
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm typecheck` / `pnpm lint` | Must both pass before a commit |
| `pnpm test:rules` | Security-rules tests on the Firebase emulators (needs Java: `brew install --cask temurin`) |
| `pnpm rules:build` | Fills `rules/*.tmpl` → `firestore.rules`, `database.rules.json`, `.firebaserc` (all gitignored) |
| `pnpm rules:deploy` | `rules:build`, then `firebase deploy --only firestore:rules,database` |
| `pnpm cloudinary:presets` | Creates/updates the two upload presets |
| `pnpm tick:dry` | Calls `/api/tick?dry=1` and prints the plan (`TICK_URL` to point at a deployment) |
| `pnpm reset:dry` / `pnpm reset` | Wipe everything except the owner's account (dry run by default) |
| `pnpm icons` | Regenerates the PWA icons and badge from the inline SVG |

## Contributing (to yourself, later)

Read [`docs/adding-a-feature.md`](docs/adding-a-feature.md). The short version: types → `lib/db` → rules + test → screen → push/toast → typecheck + lint → **update `docs/` and `CHANGELOG.md` in the same commit** → push. `CLAUDE.md` holds the rules an AI pair-programmer follows for this repo, including that documentation rule.

## Security

Deny-by-default rules with the two emails compiled in, revocation-checked ID tokens and rate limits on every API route, signed Cloudinary uploads, media rendered only from our own cloud, CSP and friends in `next.config.ts`. Details and the threat model in [`docs/security.md`](docs/security.md).

## License

Private project. No license granted.
