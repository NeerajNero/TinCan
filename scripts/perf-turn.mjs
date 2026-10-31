#!/usr/bin/env node
/**
 * Turn latency, measured locally against the Firebase emulators and a
 * production `next start`: for a Battleship shot, a Hangman guess and a
 * local-engine move (an RTDB transaction like `playMove`), the time from the
 * request to (a) the HTTP response and (b) the game node reflecting the move
 * through an RTDB listener, which is what the phone's board waits for.
 *
 *   firebase emulators:exec --only auth,firestore,database --project demo-tincan \
 *     "node scripts/perf-turn.mjs [--skip-build] [--runs 12] [--out file.json]"
 *
 * Emulator latencies are tiny compared with production, so the useful figure
 * is the number of sequential round trips a request costs; the script prints
 * both. Nothing here touches a real project: the service account is a
 * throwaway key generated on the fly, and the emulators only accept it because
 * emulator hosts are set.
 */
import { spawn } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

const require = createRequire(import.meta.url);
const { initializeApp, cert, deleteApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getDatabase } = require("firebase-admin/database");
const { getFirestore } = require("firebase-admin/firestore");

const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const RUNS = Number(opt("--runs", "12"));
const WARMUP = 2;
const PORT = 3123;
const PROJECT = "demo-tincan";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const DB_HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
if (!AUTH_HOST || !DB_HOST || !process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("Run inside `firebase emulators:exec --only auth,firestore,database --project demo-tincan`.");
  process.exit(1);
}

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const serviceAccount = Buffer.from(JSON.stringify({ project_id: PROJECT, client_email: `perf@${PROJECT}.iam.gserviceaccount.com`, private_key: privateKey })).toString("base64");
const EMAIL_A = "perf-a@example.com";
const EMAIL_B = "perf-b@example.com";
const env = {
  ...process.env,
  NODE_ENV: "production",
  NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${PORT}`,
  NEXT_PUBLIC_FIREBASE_API_KEY: "perf-fake-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${PROJECT}.firebaseapp.com`,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: PROJECT,
  NEXT_PUBLIC_FIREBASE_DATABASE_URL: `http://${DB_HOST}?ns=${PROJECT}`,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "000000000000",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:000000000000:web:0000000000000000",
  NEXT_PUBLIC_FIREBASE_VAPID_KEY: "perf-fake-vapid-key",
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: "perf-fake",
  NEXT_PUBLIC_CLOUDINARY_PRESET_IMAGE: "tincan_image",
  NEXT_PUBLIC_CLOUDINARY_PRESET_AUDIO: "tincan_audio",
  FIREBASE_SERVICE_ACCOUNT: serviceAccount,
  ALLOWED_EMAILS: `${EMAIL_A},${EMAIL_B}`,
  TICK_SECRET: "perf-tick-secret",
};

function run(cmd, cmdArgs, opts = {}) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, cmdArgs, { cwd: root, env, stdio: "inherit", ...opts });
    p.on("exit", (code) => (code === 0 ? res() : rej(new Error(`${cmd} exited ${code}`))));
  });
}

async function waitFor(url, ms = 60_000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`server did not answer at ${url}`);
}

const stats = (xs) => {
  const s = xs.slice().sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { median: Math.round(q(0.5)), p90: Math.round(q(0.9)), min: Math.round(s[0]), max: Math.round(s[s.length - 1]), n: s.length };
};

async function main() {
  if (!flag("--skip-build")) {
    console.log("[perf] building with emulator settings…");
    await run("pnpm", ["exec", "next", "build"]);
  }
  process.env.FIREBASE_SERVICE_ACCOUNT = serviceAccount;
  const app = initializeApp({ credential: cert({ projectId: PROJECT, clientEmail: `perf@${PROJECT}.iam.gserviceaccount.com`, privateKey }), projectId: PROJECT, databaseURL: env.NEXT_PUBLIC_FIREBASE_DATABASE_URL });
  const auth = getAuth(app);
  const rtdb = getDatabase(app);
  const fs = getFirestore(app);

  // Two verified users on the allowlist, with ID tokens from the Auth emulator.
  const users = {};
  for (const email of [EMAIL_A, EMAIL_B]) {
    const u = await auth.createUser({ email, password: "perf-password-1", emailVerified: true, displayName: email.split("@")[0] });
    const r = await fetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "perf-password-1", returnSecureToken: true }) });
    const j = await r.json();
    if (!j.idToken) throw new Error(`no id token for ${email}: ${JSON.stringify(j)}`);
    users[email] = { uid: u.uid, token: j.idToken };
    await fs.doc(`users/${u.uid}`).set({ nickname: email.split("@")[0], email, fcmTokens: [], notif: { enabled: false }, tz: "UTC" });
  }
  const A = users[EMAIL_A];
  const B = users[EMAIL_B];
  await fs.doc("pair/main").set({ uids: [A.uid, B.uid], roomTz: "UTC", records: {} });

  const fleet = JSON.stringify([{ r: 0, c: 0, len: 5, dir: "h" }, { r: 2, c: 0, len: 4, dir: "h" }, { r: 4, c: 0, len: 3, dir: "h" }, { r: 6, c: 0, len: 3, dir: "h" }, { r: 8, c: 0, len: 2, dir: "h" }]);
  const now = Date.now();
  const base = (type, state, turn) => ({ type, state: JSON.stringify(state), turn, players: { first: A.uid, second: B.uid }, status: "active", open: true, createdBy: A.uid, createdAt: now, lastMoveAt: now, moves: 0, winnerId: null, endReason: null });
  const seedBattleship = async () => {
    await rtdb.ref("games/perf-bs").set(base("battleship", { phase: "firing", ready: { first: true, second: true }, shots: { first: {}, second: {} }, sunk: { first: [], second: [] }, last: null, turn: "first" }, "first"));
    await rtdb.ref("gamePrivate/perf-bs").set({ [A.uid]: { fleet }, [B.uid]: { fleet } });
  };
  const seedHangman = async () => {
    await rtdb.ref("games/perf-hm").set(base("hangman", { phase: "guessing", round: 0, rounds: [{ setter: "first", mask: "_____", guessed: "", wrong: 0 }], scores: { first: 0, second: 0 } }, "second"));
    await rtdb.ref("gamePrivate/perf-hm").set({ [A.uid]: { word: "apple", round: 0 } });
  };
  const seedTtt = () => rtdb.ref("games/perf-ttt").set(base("tictactoe", { board: "........." }, "first"));

  console.log("[perf] starting next…");
  const server = spawn("pnpm", ["exec", "next", "start", "-p", String(PORT)], { cwd: root, env, stdio: ["ignore", "pipe", "inherit"] });
  server.stdout.on("data", () => {});
  try {
    await waitFor(`http://127.0.0.1:${PORT}/api/health`);

    /** Time one request: HTTP response, and the node showing `moves >= 1` through a listener. */
    async function timed(gameId, fire) {
      const ref = rtdb.ref(`games/${gameId}`);
      let resolveSeen;
      const seen = new Promise((r) => (resolveSeen = r));
      const t0 = performance.now();
      const cb = (snap) => {
        const v = snap.val();
        if (v && (v.moves ?? 0) >= 1) resolveSeen(performance.now() - t0);
      };
      ref.on("value", cb);
      const res = await fire();
      const http = performance.now() - t0;
      const listener = await Promise.race([seen, new Promise((_, rej) => setTimeout(() => rej(new Error("listener timeout")), 10_000))]);
      ref.off("value", cb);
      return { http, listener, status: res.status, body: res.body };
    }
    const post = (path, token, body) => async () => {
      const r = await fetch(`http://127.0.0.1:${PORT}${path}`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
      return { status: r.status, body: await r.json().catch(() => null) };
    };
    const cases = {
      "battleship shot (server)": { seed: seedBattleship, fire: () => timed("perf-bs", post("/api/games/battleship/shot", A.token, { gameId: "perf-bs", cell: 90 })) },
      "hangman guess (server)": { seed: seedHangman, fire: () => timed("perf-hm", post("/api/games/hangman/guess", B.token, { gameId: "perf-hm", letter: "z" })) },
      "tic-tac-toe move (local transaction)": {
        seed: seedTtt,
        fire: () =>
          timed("perf-ttt", async () => {
            const res = await rtdb.ref("games/perf-ttt").transaction((cur) => (cur ? { ...cur, state: JSON.stringify({ board: "X........" }), turn: "second", moves: 1, lastMoveAt: Date.now() } : cur));
            return { status: res.committed ? 200 : 409, body: null };
          }),
      },
    };
    const results = {};
    for (const [name, c] of Object.entries(cases)) {
      const http = [];
      const listener = [];
      let lastStatus = null;
      let lastBody = null;
      for (let i = 0; i < RUNS; i++) {
        await c.seed();
        const r = await c.fire();
        lastStatus = r.status;
        lastBody = r.body;
        if (i >= WARMUP) {
          http.push(r.http);
          listener.push(r.listener);
        }
      }
      results[name] = { http: stats(http), listener: stats(listener), status: lastStatus, body: lastBody };
      console.log(`[perf] ${name}: http median ${results[name].http.median} ms (p90 ${results[name].http.p90}), board via listener median ${results[name].listener.median} ms (p90 ${results[name].listener.p90}), status ${lastStatus} ${JSON.stringify(lastBody)}`);
    }
    const out = opt("--out", null);
    if (out) writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), runs: RUNS, warmup: WARMUP, results }, null, 2));
  } finally {
    server.kill("SIGTERM");
    await deleteApp(app).catch(() => {});
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error("[perf] failed:", e);
    process.exit(1);
  },
);
