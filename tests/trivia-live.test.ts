/**
 * Live trivia duel against the emulators with two authenticated clients,
 * through the same `lib/db/trivia` functions the screen uses. Phase 21's
 * stall: the RTDB rules had no `trivia` node, so the cursor listener was
 * denied and (with no cancel callback) never fired, leaving both phones on
 * "Connecting…". Run with `pnpm test:rules`.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import type { Database } from "firebase/database";
import type { Firestore } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { advanceLive, answerLive, createRound, openLiveSession, switchToAsync, triviaRef, type LiveStatus } from "@/lib/db/trivia";
import { getDoc } from "@/lib/firebase/fs";
import { get, ref } from "@/lib/firebase/rt";
import { LIVE_COUNTDOWN_MS, ROUND_SIZE } from "@/lib/trivia";

const root = resolve(__dirname, "..");
function parseEnv(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/\s+#.*$/, "").replace(/^(['"])(.*)\1$/, "$2")];
      }),
  );
}
// Local: .env / .env.local. CI: the workflow env (placeholders in .github/workflows/ci.yml) wins.
const env = { ...parseEnv(resolve(root, ".env")), ...parseEnv(resolve(root, ".env.local")), ...process.env };
const [EMAIL_A, EMAIL_B] = (env.ALLOWED_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase());
const A = "uid-host";
const B = "uid-guest";

let env$: RulesTestEnvironment;
beforeAll(async () => {
  if (!EMAIL_A || !EMAIL_B) throw new Error("ALLOWED_EMAILS needs two emails for the live trivia test");
  env$ = await initializeTestEnvironment({
    projectId: "tincan-live-test",
    firestore: { rules: readFileSync(resolve(root, "firestore.rules"), "utf8"), host: "127.0.0.1", port: 8181 },
    database: { rules: readFileSync(resolve(root, "database.rules.json"), "utf8"), host: "127.0.0.1", port: 9191 },
  });
});
afterAll(async () => env$?.cleanup());
beforeEach(async () => {
  await env$.clearFirestore();
  await env$.clearDatabase();
});

/** The emulator contexts hand back compat-typed instances; the modular SDK accepts them. */
const client = (uid: string, email: string) => {
  const ctx = env$.authenticatedContext(uid, { email, email_verified: true });
  return { db: ctx.firestore() as unknown as Firestore, rtdb: ctx.database() as unknown as Database };
};

async function waitFor(check: () => boolean, ms = 8000, label = "condition", detail?: () => unknown): Promise<void> {
  const until = Date.now() + ms;
  while (!check()) {
    if (Date.now() > until) throw new Error(`timed out waiting for ${label}${detail ? `: ${JSON.stringify(detail())}` : ""}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

/** Both clients open the round and record every status they see. */
function openBoth(id: string) {
  const host = client(A, EMAIL_A!);
  const guest = client(B, EMAIL_B!);
  const seenA: LiveStatus[] = [];
  const seenB: LiveStatus[] = [];
  const stopA = openLiveSession(id, A, [A, B], (s) => seenA.push(s), host.rtdb);
  const stopB = openLiveSession(id, B, [A, B], (s) => seenB.push(s), guest.rtdb);
  const last = (list: LiveStatus[]) => list[list.length - 1];
  return { host, guest, seenA, seenB, lastA: () => last(seenA), lastB: () => last(seenB), stop: () => (stopA(), stopB()), detail: () => ({ seenA, seenB }) };
}

describe("live trivia duel", () => {
  it("host creates and opens live, guest joins: both reach the first question", async () => {
    const host = client(A, EMAIL_A!);
    const id = await createRound(A, [A, B], "live", host.db);
    const s = openBoth(id);
    try {
      await waitFor(() => s.lastA()?.phase === "playing" && s.lastB()?.phase === "playing", 8000, "both players at question 1", s.detail);
      const a = s.lastA();
      const b = s.lastB();
      if (a?.phase !== "playing" || b?.phase !== "playing") throw new Error("unreachable");
      expect(a.qIndex).toBe(0);
      expect(b.qIndex).toBe(0);
      // One start, both joined, a countdown before the clock runs.
      expect(a.cursor.startedBy === A || a.cursor.startedBy === B).toBe(true);
      expect(a.cursor.joined?.[A]).toBeTypeOf("number");
      expect(a.cursor.joined?.[B]).toBeTypeOf("number");
      expect((a.cursor.qStartedAt ?? 0) - Date.now()).toBeGreaterThan(LIVE_COUNTDOWN_MS - 2000);
      expect(s.seenA.some((x) => x.phase === "error")).toBe(false);
      expect(s.seenB.some((x) => x.phase === "error")).toBe(false);
      // The guest's listener attached before the host's node existed: it saw "waiting" first, then "playing".
      expect(s.seenB[0]?.phase).toBe("waiting");
    } finally {
      s.stop();
    }
  });

  it("the round waits while only one player is in, and never starts twice", async () => {
    const host = client(A, EMAIL_A!);
    const id = await createRound(A, [A, B], "live", host.db);
    const seen: LiveStatus[] = [];
    const stop = openLiveSession(id, A, [A, B], (s) => seen.push(s), host.rtdb);
    try {
      await waitFor(() => seen.some((s) => s.phase === "waiting" && typeof s.cursor.joined?.[A] === "number"), 5000, "host joined");
      await new Promise((r) => setTimeout(r, 400));
      expect(seen.every((s) => s.phase === "waiting")).toBe(true);
    } finally {
      stop();
    }
    const s = openBoth(id);
    try {
      await waitFor(() => s.lastA()?.phase === "playing" && s.lastB()?.phase === "playing", 8000, "start after the guest joins");
      const starts = new Set([...s.seenA, ...s.seenB].filter((x) => x.phase === "playing").map((x) => (x.phase === "playing" ? x.cursor.qStartedAt : 0)));
      expect(starts.size).toBe(1);
    } finally {
      s.stop();
    }
  });

  it("answers from both advance the cursor in lockstep, to the end", async () => {
    const host = client(A, EMAIL_A!);
    const id = await createRound(A, [A, B], "live", host.db);
    const s = openBoth(id);
    try {
      await waitFor(() => s.lastA()?.phase === "playing" && s.lastB()?.phase === "playing", 8000, "question 1");
      await answerLive(id, A, 2, s.host.rtdb);
      await answerLive(id, B, -1, s.guest.rtdb);
      await waitFor(() => {
        const a = s.lastA();
        return a?.phase === "playing" && a.cursor.answered?.[A] === 2 && a.cursor.answered?.[B] === -1;
      }, 5000, "both answers visible");
      // Both clients race to advance; exactly one transaction wins and the other aborts.
      await Promise.all([advanceLive(id, 0, ROUND_SIZE, s.host.rtdb), advanceLive(id, 0, ROUND_SIZE, s.guest.rtdb)]);
      const idx = (st: LiveStatus | undefined) => (st?.phase === "playing" ? st.qIndex : -1);
      await waitFor(() => idx(s.lastA()) === 1 && idx(s.lastB()) === 1, 5000, "question 2", s.detail);
      const after = s.lastA();
      expect(after?.phase === "playing" && after.cursor.answered).toBeFalsy();
      expect(after?.phase === "playing" && after.cursor.joined?.[B]).toBeTypeOf("number");
      await advanceLive(id, ROUND_SIZE - 1, ROUND_SIZE, s.host.rtdb); // stale index: aborts, no change
      expect(idx(s.lastA())).toBe(1);
    } finally {
      s.stop();
    }
  });

  it("switching to async works from either phone and ends the live session", async () => {
    const host = client(A, EMAIL_A!);
    const id = await createRound(A, [A, B], "live", host.db);
    const s = openBoth(id);
    try {
      await waitFor(() => s.lastB()?.phase === "playing", 8000, "started");
      await switchToAsync(id, s.guest.db, s.guest.rtdb);
      await waitFor(() => s.lastA()?.phase === "error" && s.lastA()?.phase === "error", 5000, "host sees the node go");
      expect((await getDoc(triviaRef(id, s.host.db))).data()?.mode).toBe("async");
      expect((await get(ref(s.host.rtdb, `trivia/${id}`))).exists()).toBe(false);
    } finally {
      s.stop();
    }
  });
});
