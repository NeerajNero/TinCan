/**
 * Pictionary rounds against the emulators with two authenticated clients,
 * through the same `lib/db/pictionary` / `lib/db/together` functions the screen
 * uses. The bug this guards: strokes used to live under `pictionary/{id}`, so
 * the round transaction on that node was invalidated by every streamed point
 * and rejected with `maxretry` mid-drawing. Run with `pnpm test:rules`.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import type { Database } from "firebase/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { acceptPictionary, chooseWord, endRound, invitePictionary, nextRound, pictStrokesBase, submitGuess, type LivePictionary, type PictionaryNode } from "@/lib/db/pictionary";
import { addStroke, streamLive } from "@/lib/db/together";
import { get, ref } from "@/lib/firebase/rt";

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
const env = { ...parseEnv(resolve(root, ".env")), ...parseEnv(resolve(root, ".env.local")), ...process.env };
const [EMAIL_A, EMAIL_B] = (env.ALLOWED_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase());
const A = "uid-drawer";
const B = "uid-guesser";

let env$: RulesTestEnvironment;
beforeAll(async () => {
  if (!EMAIL_A || !EMAIL_B) throw new Error("ALLOWED_EMAILS needs two emails for the live pictionary test");
  env$ = await initializeTestEnvironment({
    projectId: "tincan-pictionary-test",
    database: { rules: readFileSync(resolve(root, "database.rules.json"), "utf8"), host: "127.0.0.1", port: 9191 },
  });
});
afterAll(async () => env$?.cleanup());
beforeEach(async () => env$.clearDatabase());

/** The emulator contexts hand back compat-typed instances; the modular SDK accepts them. */
const rtdbOf = (uid: string, email: string) => env$.authenticatedContext(uid, { email, email_verified: true }).database() as unknown as Database;

const stroke = (i: number) => ({ uid: A, color: "#ff6b6b", width: 7, points: JSON.stringify([[0.1, 0.1 + i / 1000], [0.2, 0.2]]) });

/** A started game: A invited, B accepted, A (the drawer) picked a word. */
async function startedGame(drawer: Database, guesser: Database): Promise<string> {
  const id = await invitePictionary(A, B, 3, drawer);
  await acceptPictionary(id, guesser);
  await chooseWord(id, "cat", drawer);
  return id;
}

async function liveOf(id: string, db: Database): Promise<LivePictionary> {
  const snap = await get(ref(db, `pictionary/${id}`));
  return { id, ...(snap.val() as PictionaryNode) };
}

/** The drawer's hand: a live point every few ms and a finished stroke every tenth, until stopped. */
function keepDrawing(id: string, db: Database) {
  let running = true;
  let written = 0;
  const base = pictStrokesBase(id);
  const loop = (async () => {
    while (running) {
      written += 1;
      await streamLive(base, A, stroke(written), db);
      if (written % 10 === 0) await addStroke(base, stroke(written), written / 10, null, db);
    }
  })();
  return {
    stop: async () => {
      running = false;
      await loop;
      return written;
    },
  };
}

describe("pictionary rounds while the drawer keeps drawing", () => {
  it("advancing the round succeeds while strokes are being written concurrently, and the canvas is cleared", async () => {
    const drawer = rtdbOf(A, EMAIL_A!);
    const guesser = rtdbOf(B, EMAIL_B!);
    const id = await startedGame(drawer, guesser);
    const hand = keepDrawing(id, drawer);
    try {
      await new Promise((r) => setTimeout(r, 150)); // some strokes on the canvas first
      await endRound(id, guesser);
      const advanced = await nextRound(await liveOf(id, guesser), guesser);
      expect(advanced).toBe(true);
    } finally {
      expect(await hand.stop()).toBeGreaterThan(20);
    }
    const after = await liveOf(id, guesser);
    expect(after.round).toBe(2);
    expect(after.drawerUid).toBe(B);
    expect(after.word ?? null).toBeNull(); // RTDB drops null values
    expect(after).not.toHaveProperty("strokes");
    expect(after).not.toHaveProperty("live");
  });

  it("a guess lands and scores while the drawer is mid-stroke", async () => {
    const drawer = rtdbOf(A, EMAIL_A!);
    const guesser = rtdbOf(B, EMAIL_B!);
    const id = await startedGame(drawer, guesser);
    const hand = keepDrawing(id, drawer);
    try {
      const game = await liveOf(id, guesser);
      expect(await submitGuess(game, B, "dog", game.roundStartedAt + 1000, guesser)).toBe(false);
      expect(await submitGuess(game, B, "Cat!", game.roundStartedAt + 1000, guesser)).toBe(true);
    } finally {
      await hand.stop();
    }
    const after = await liveOf(id, guesser);
    expect(after.roundOver).toBe(true);
    expect(after.solvedBy).toBe(B);
    expect(after.scores[B]).toBe(10);
    expect(after.scores[A]).toBe(5);
  });

  it("both phones tapping Next round advance it exactly once", async () => {
    const drawer = rtdbOf(A, EMAIL_A!);
    const guesser = rtdbOf(B, EMAIL_B!);
    const id = await startedGame(drawer, guesser);
    await endRound(id, drawer);
    const seen = await liveOf(id, drawer);
    const results = await Promise.all([nextRound(seen, drawer), nextRound({ ...seen }, guesser)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await liveOf(id, drawer)).round).toBe(2);
  });
});
