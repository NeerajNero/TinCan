# Tincan 🥫

A private, installable web app for two people who live apart: chat, presence, pings and a lamp, games you play across cities, things to do together in real time, shared memories, planning, and a pet and garden you look after between you. Exactly two users, ever. Runs on free tiers only.

The full product and engineering spec is `CLAUDE.md`; this file is the setup guide.

## Setup from zero

You need a Google account for each of the two people, a Firebase project, a Cloudinary account, a Vercel account and a cron-job.org account. Everything below stays on free plans.

### 1. Firebase (Spark plan)

1. Create a project at console.firebase.google.com. Say no to Google Analytics and to Gemini features.
2. **Authentication** → Sign-in method → enable **Google**. Under Settings → Authorized domains, add your Vercel domain (e.g. `tin-can.vercel.app`) once you have it.
3. **Firestore Database** → Create database, native mode, any region close to you.
4. **Realtime Database** → Create database (locked mode is fine; rules come from this repo).
5. **Cloud Messaging** → Web Push certificates → Generate key pair. That's `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
6. Project settings → General → add a **Web app**. Copy the config values into the `NEXT_PUBLIC_FIREBASE_*` variables.
7. Project settings → Service accounts → Generate new private key. Base64 the JSON on one line: `base64 -i sa.json | tr -d '\n'` → `FIREBASE_SERVICE_ACCOUNT`.
8. Never enable Cloud Functions, Storage or Extensions; the app doesn't use them and they need Blaze.

### 2. Cloudinary (free)

1. Note your cloud name, API key and API secret from the dashboard → `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
2. Run `pnpm cloudinary:presets` once (after the env is filled in). It creates the two unsigned upload presets the app needs: `tincan_image` (folder `tincan/images`, incoming transform to 1080 px, auto-low quality) and `tincan_audio` (folder `tincan/audio`). You can also make them by hand in Settings → Upload.

### 3. Local env

```bash
pnpm install
cp .env.example .env.local     # fill in everything; ALLOWED_EMAILS is the two Google emails, comma-separated
pnpm rules:deploy              # builds rules from the templates and deploys them (needs: npm i -g firebase-tools && firebase login)
pnpm dev
```

`ALLOWED_EMAILS` is the pairing: the first email is the owner, the second is the friend. Changing it later means rebuilding and redeploying rules.

### 4. Vercel (Hobby)

1. Import the repo. Framework: Next.js. Node 22 is pinned in `package.json`.
2. Add every variable from `.env.example` under Settings → Environment Variables. Set `NEXT_PUBLIC_APP_URL` to the deployment URL.
3. Deploy. Visit `/api/health` on the deployment: it reports the Node version, whether each required env key is set, and whether the admin SDK loads. All green means sign-in will work.
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
| `pnpm icons` | Regenerates the PWA icons and badge from the inline SVG |
| `pnpm rules:build` | Fills `rules/*.tmpl` with `ALLOWED_EMAILS` → `firestore.rules`, `database.rules.json`, `.firebaserc` (all gitignored) |
| `pnpm rules:deploy` | `rules:build`, then `firebase deploy --only firestore:rules,database` |
| `pnpm cloudinary:presets` | Creates/updates the two unsigned upload presets |
| `pnpm tick:dry` | Calls `/api/tick?dry=1` and prints the plan (`TICK_URL` to point at a deployment) |
| `pnpm reset:dry` / `pnpm reset` | Maintenance: wipe everything except the owner's account (dry run by default) |

## How it's built

Next.js App Router with TypeScript and Tailwind v4, installable as a PWA through a Serwist service worker that also carries the FCM background handler. Firebase on the Spark plan: Google sign-in gated by an email allowlist enforced in the rules and on the server, Firestore for everything persistent, the Realtime Database for everything ephemeral (presence, typing, pings, lamps, live boards, canvases, watch/listen sync, timers), and Cloud Messaging sent from Next API routes with `firebase-admin`. Photos and voice notes go straight from the browser to Cloudinary with unsigned presets; the secret only lives in server routes. Free keyless APIs do the rest: Open-Meteo for weather and geocoding, OpenStreetMap tiles via Leaflet, the YouTube IFrame player, and a handful of public radio streams.

Every Firestore listener is bounded, the Home screen subscribes to exactly six documents, and More has a usage meter that extrapolates this device's reads and writes against the free quota. The security rules live as templates in `rules/` so the allowlist never lands in git.

Read `CLAUDE.md` for the screens, data model, feature specs, security rules and the thirteen-phase build order the app was built in.
