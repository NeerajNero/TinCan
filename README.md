# Tincan 🥫

A private little app for two people who live apart. It's a tin-can telephone you install on your phones: a WhatsApp-style chat, a "who's awake" presence card, hugs and waves that buzz the other phone, a lamp you can light on their shelf, games you play across cities, things to do together in real time (draw, watch YouTube, listen to the radio), shared memories, plans for the next meetup, and a pet and a garden you look after between you.

It is built for **exactly two Google accounts**, and nobody else can open it. It runs on free tiers only.

> 📸 Screenshots: add a few phone screenshots to `docs/screenshots/` and link them here (Home, Chat, Play, Memories).

| Tab | What's in it |
| --- | --- |
| **Home** | friend's presence, local time, weather and distance · four pings with haptics · lamp · mood check-in · daily question · streak + plant · pet · meetup countdown · next milestone · open games · good night / good morning |
| **Chat** | ✓ / ✓✓ / blue ticks, typing, swipe to reply, reactions, edit/delete, photos, voice notes, GIFs, stickers, scheduled messages, offline queue, chat backgrounds |
| **Play** | tic-tac-toe, connect four, chess, checkers · would-you-rather, never-have-I-ever, truth or dare, conversation cards · 20 Questions · hangout wheel · trivia duel · know-me quiz · daily word · whiteboard, pixel art, pictionary, watch together, listen together, radio, focus timer, cook-along |
| **Memories** | photo timeline · memory map · milestones · journal · jar · time capsules · open-when envelopes · mood history · daily-question history · garden |
| **Plan** | meetup countdown · call-time finder across time zones · bucket list, wishlist, gift ideas, to-do · trips |
| **More** | profile, theme, chat background, notifications, sounds, usage meter, sign out |

Documentation for developers lives in [`docs/`](docs/README.md). The product and engineering spec, and the rules an AI pair-programmer follows here, are in [`CLAUDE.md`](CLAUDE.md). Changes are recorded in [`CHANGELOG.md`](CHANGELOG.md).

---

## Setup checklist (from zero)

You need a Google account for each of the two people, plus free accounts on Firebase, Cloudinary, Vercel and cron-job.org. Optionally, a GIPHY developer key.

### 1. Firebase (Spark plan, free)

- [ ] Create a project at console.firebase.google.com. Say no to Analytics and Gemini.
- [ ] **Authentication** → Sign-in method → enable **Google**. Settings → Authorized domains: add your Vercel domain once you have it.
- [ ] **Firestore Database** → create, native mode, in a region near you.
- [ ] **Realtime Database** → create (locked mode is fine; this repo deploys the rules). Singapore (`asia-southeast1`) suits South and Southeast Asia.
- [ ] **Cloud Messaging** → Web Push certificates → Generate key pair. This is `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
- [ ] Project settings → General → add a **Web app** and copy its config into the `NEXT_PUBLIC_FIREBASE_*` variables.
- [ ] Project settings → Service accounts → Generate new private key. Base64 it on one line (`base64 -i sa.json | tr -d '\n'`). This is `FIREBASE_SERVICE_ACCOUNT`. Delete the JSON file afterwards.
- [ ] Never enable Cloud Functions, Storage or Extensions. The app doesn't use them, and they need the paid Blaze plan.

### 2. Restrict the browser API key (Google Cloud)

The Firebase web API key is public by design, but you can stop anyone else's site from using it.

- [ ] console.cloud.google.com → your project → APIs & Services → Credentials → the "Browser key (auto created by Firebase)".
- [ ] **Application restrictions** → Websites: `https://<your-domain>/*` and `http://localhost:3000/*`.
- [ ] **API restrictions** → restrict the key to: Identity Toolkit API, Token Service API, Cloud Firestore API, Firebase Installations API, FCM Registration API.
- [ ] Sign in once afterwards. If sign-in breaks, the console's error names the missing API; add it to the list.

### 3. Cloudinary (free)

- [ ] From the dashboard, copy the cloud name, API key and API secret into `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`.
- [ ] Run `pnpm cloudinary:presets` once the env is filled in. It creates or updates `tincan_image` and `tincan_audio` in **Signed** mode with delivery type **authenticated**.
- [ ] Check in Settings → Upload that both presets say *Signed* and *Authenticated*. Without the right mode, uploads fail or media becomes publicly fetchable.

### 4. Local env

```bash
pnpm install
cp .env.example .env.local      # fill in every value; ALLOWED_EMAILS = the two Google emails, comma-separated
npm i -g firebase-tools && firebase login
pnpm rules:deploy               # builds the security rules with your two emails and deploys them
pnpm dev
```

`ALLOWED_EMAILS` *is* the pairing. The first email is the owner. The values live only in `.env*` and on Vercel. Never commit or paste them.

### 5. Vercel (Hobby, free)

- [ ] Import the repo (framework: Next.js; Node 22 is pinned in `package.json`).
- [ ] Settings → Environment Variables: add every variable from `.env.example`. `NEXT_PUBLIC_APP_URL` is the deployment URL. `GIPHY_API_KEY` is optional and server-only.
- [ ] Settings → Functions → **Function Region: Singapore (`sin1`)**. Every page and API call runs as a function, so put them next to the Realtime Database and the two of you.
- [ ] Deploy, then open `/api/health`. It reports the Node version, which env keys are set, and whether the admin SDK loads.
- [ ] Don't add `crons` to `vercel.json`; Hobby crons are daily-only.

### 6. cron-job.org (the scheduler)

- [ ] Create a job that GETs `https://<your-domain>/api/tick` every 15 minutes with the header `x-tick-secret: <TICK_SECRET>`.
- [ ] Live runs answer with counts only. Run `pnpm tick:dry` (set `TICK_URL` to your deployment) to see what a tick would do.

### 7. First run

Both people sign in with Google and pick a nickname and city; that forms the pair. Notifications stay off until each person turns them on in More → Notifications. On Android, install from Chrome's menu ("Add to Home screen") for the icon and background pushes.

---

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Dev server (the service worker and push are disabled in dev) |
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm typecheck` | TypeScript (`strict` + `noUncheckedIndexedAccess`) |
| `pnpm lint` | ESLint (Next, TypeScript, React Compiler rules, import order) |
| `pnpm test` | Unit tests: game engines, dates and streak, pet, call-time overlap, pings, Recent games, theme script |
| `pnpm test:rules` | Security-rules tests on the Firebase emulators (needs Java: `brew install --cask temurin`) |
| `pnpm test:e2e` | Builds, then Playwright on a phone viewport: no CSP violations (page and worker), the document never scrolls. First run: `npx playwright install chromium` |
| `pnpm rules:deploy` | Builds `rules/*.tmpl` with your emails and deploys Firestore + Realtime Database rules |
| `pnpm tick:dry` | Shows what the scheduler would do right now, without sending anything |
| `pnpm reset:dry` / `pnpm reset` | Wipes everything except the owner's account (dry run by default) |
| `pnpm export` | Backup: dated JSON of all Firestore data plus a CSV of media URLs in `./exports/` |
| `pnpm migrate-media` | Dry run: counts public media to make private. `pnpm migrate-media --yes` moves it to authenticated delivery and re-signs every stored URL |
| `pnpm cloudinary:presets` | Creates/updates the two upload presets (Signed, authenticated) |
| `pnpm analyze` / `pnpm knip` / `pnpm profile:chat` | Bundle report / dead-code check / chat render profile |

---

## Privacy & access

**Who can see what.** Only the two allowlisted Google accounts can sign in, read or write anything. Inside the app, both of you see everything you share, with these exceptions:
- **Gift ideas** are visible only to whoever added them.
- **Time-capsule bodies** stay hidden from the other person until the unlock time.
- **Open-when envelope bodies** stay hidden until the recipient opens them.
- **Scheduled messages** are visible only to their sender until they are delivered.

The rules enforce all of this, not just the UI.

**Where each kind of data lives.**

| Data | Where |
| --- | --- |
| Profiles, messages, journal, memories metadata, lists, plans, game results, moods, daily answers | Firestore (Google, your chosen region) |
| Presence, typing, pings, lamps, live game boards, canvases, watch/listen state, timers | Realtime Database (Google, `asia-southeast1` if you followed the checklist) |
| Photos, voice notes, avatars | Cloudinary, **private**: authenticated delivery, loadable only through signed URLs stored on the docs |
| Static content (questions, decks, word lists) | Bundled with the app |
| Theme, sounds toggle, weather cache, FCM token | The phone's local storage |
| Backups | Wherever you keep `./exports/`, and nowhere else |

**What third parties receive.**

| Who | What they see | When |
| --- | --- | --- |
| **Google (Firebase)** | Everything stored in Firestore and the Realtime Database; your Google sign-in | Always (it's the database) |
| **Google (Cloud Messaging)** | Every push's title and body: the sender's nickname and the first 140 characters of a message, or a fixed line like "📷 Photo", "sent you a hug", a capsule or milestone title, the pet's name | Each notification |
| **Google (profile photos)** | Your phone's IP, when it loads a Google profile photo (only if you have no custom avatar) | Avatar display |
| **Cloudinary** | All photos and voice notes (stored and resized) | Upload and view |
| **Vercel** | Request logs (IP, path, time); server code handles push text and GIF searches in memory | Every page and API call |
| **GIPHY** | Search terms and trending requests, **from our server** (not your IP). Your phone then loads the chosen GIFs from `media.giphy.com` (your IP; the referrer is only the site's origin) | Using the GIF tab |
| **Open-Meteo** | Your friend's city coordinates (the geocoded city centre, not GPS) when Home shows their weather; the city name you type during onboarding or in Profile | Home, city search |
| **YouTube (Google)** | The video URL (oEmbed title lookup), thumbnails, and playback through the privacy-enhanced `youtube-nocookie.com` player | Watch / listen together |
| **OpenStreetMap tile servers** | Which map tiles you view (≈ the area) and your IP | Memory map |
| **Radio Paradise, Radio France** | Your IP while a station plays | Radio |
| **cron-job.org** | That `/api/tick` ran and how many actions it took (no names or text) | Every 15 min |

Fonts are self-hosted, so Google Fonts receives nothing.

**Revoking someone.** For example, the second account changes, or a phone is lost.
1. Remove the email from `ALLOWED_EMAILS` in `.env.local`.
2. Run `pnpm rules:deploy`. The rules stop accepting that account immediately.
3. Update `ALLOWED_EMAILS` on Vercel and redeploy. The API guard now refuses them too.
4. Firebase console → Authentication → delete the user. This revokes their sessions; the API checks revocation.
5. To start over with a new second person, run `pnpm reset:dry`, then `pnpm reset`. The pair's uids can only grow, by design.
6. **Media links are permanent capabilities.** Someone who saved a signed URL can still open that one file. To cut that off, rotate `CLOUDINARY_API_SECRET` in the Cloudinary console, update it everywhere, and run `pnpm migrate-media --yes`. That re-signs every stored URL, and the old ones stop working.

**Backups.** The Spark plan has no managed Firestore exports, so **`pnpm export` is the only backup**. Run it now and then and keep the folder private: it contains your journal, capsule bodies, and signed media links.

---

## Security model

- **Allowlist, twice.** The two emails are compiled into the Firestore and Realtime Database rules, which deny by default. Every API route also goes through one guard that requires a verified, allowlisted email.
- **The guard** (`src/lib/server/guard.ts`) does all of this:
  - checks ID tokens with revocation;
  - caps request bodies at 16 KB and validates them with strict zod schemas;
  - applies a per-user token bucket;
  - enforces daily caps (push 1000, uploads 300, URL signing 300, GIFs 1000);
  - returns minimal error bodies.
- **Media.** Uploads are signed for a fixed parameter set. Assets use authenticated delivery, and their URLs are signed server-side for a fixed set of variants. Unsigned or tampered URLs return 401. The rules validate every stored media URL.
- **CSP with a nonce.** A per-request nonce, with no `'unsafe-inline'` scripts and an exact host list (`csp.ts`). The service worker has its own policy. `CSP_REPORT_ONLY=1` switches to report-only for debugging.
- **Other headers.** nosniff, `X-Frame-Options: DENY`, a strict referrer policy, and a Permissions-Policy that allows only the microphone.
- **Rules tests.** `pnpm test:rules` covers: strangers blocked, message edit rights, private bodies, gifts privacy, pings, pair uids, signed media, place unlinking.
- **Secrets.** Server-only. The client bundle is checked to contain none.

---

## Costs & quotas

Everything runs on free tiers. Limits below were correct when written; check each provider's pricing page.

| Service | Free limit that matters | How Tincan stays under it |
| --- | --- | --- |
| Firestore (Spark) | 50k reads, 20k writes, 20k deletes per day; 1 GiB stored | Every listener is bounded; Home reads six docs; summaries mirrored onto `pair/main` |
| Realtime Database (Spark) | 100 simultaneous connections, 1 GB stored, 10 GB/month download | Listeners only while a screen is open; strokes and cursors throttled |
| Cloud Messaging, Auth | Free | — |
| Cloudinary (free) | 25 credits/month (storage, bandwidth and transformations share them) | Photos compressed to ~0.3 MB in the browser; small fixed variant set; the worker caches images for 30 days |
| Vercel (Hobby) | Monthly function invocations, CPU time and bandwidth caps | Two users; static assets cached by the worker; the function region sits next to the database |
| cron-job.org, Open-Meteo, OSM tiles, YouTube | Free (fair use) | One tick per 15 min; weather cached on the phone |
| GIPHY (beta key) | Low hourly request limit | 500 ms debounce; trending cached 10 min on the server and for the session on the phone |

**More → Usage** shows this device's Firestore reads and writes for today, extrapolated against the free quota.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| **"You're offline" banner even though the network is fine, or blank screens** | Usually the CSP blocking something. Set `CSP_REPORT_ONLY=1` on Vercel, redeploy, and read the console's `Content-Security-Policy` lines. Add the host to `csp.ts`, then unset the flag. |
| **Offline banner never goes away on one phone** | Open More → Diagnostics (owner account) and look at "RTDB connected", "RTDB transport" and the error list. **Copy diagnostics** puts it all on the clipboard to share. |
| **A new deploy isn't showing on the installed app** | Reopen the app; it checks for updates on launch and resume and shows "Update available, tap to reload". |
| **Push not arriving** | Each person must turn on More → Notifications on each phone, and Android must allow notifications for the installed app. Use "Send a test". Push never works in `pnpm dev`. A message push is skipped while the other person has the chat open. |
| **Upload fails** | Check the presets: both must be **Signed** with delivery type **authenticated** (`pnpm cloudinary:presets`). Then check `/api/health` (Cloudinary secret set?). |
| **Old photos show 🚫** | They're still on public delivery or lack signed variants. Run `pnpm migrate-media`, then `--yes`. |
| **Sign-in loops** | The email isn't in `ALLOWED_EMAILS` on Vercel, or `FIREBASE_SERVICE_ACCOUNT` is wrong. `/api/health` tells you which. |
| **`permission-denied` in the console** | Rules changed but weren't deployed: `pnpm rules:deploy`. |

More in [`docs/troubleshooting.md`](docs/troubleshooting.md).

---

## How it's built

Next.js 16 (App Router, Turbopack), TypeScript, Tailwind v4 and Framer Motion, installable as a PWA through a Serwist service worker that also receives pushes. Firebase on the Spark plan provides Google sign-in, Firestore for anything that must last, the Realtime Database for anything live, and Cloud Messaging sent from Next API routes. Media lives in Cloudinary as private assets. Weather comes from Open-Meteo, maps from OpenStreetMap, watch-together from the YouTube IFrame player, plus a handful of public radio streams.

- **Spec and rules:** [`CLAUDE.md`](CLAUDE.md), covering screens, data model, feature specs, security and build order.
- **Developer docs:** [`docs/`](docs/README.md), covering architecture, data model, features → code, API, security, operations, conventions, adding a feature, testing and troubleshooting.

## License

Private project. No license granted.
