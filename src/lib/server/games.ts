import "server-only";

import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { adminDb, adminRtdb } from "@/lib/firebase/admin";
import { gameInfo } from "@/lib/games/catalog";
import { describeResult, opponentOf, resultForRecipient, uidOf, type GameNode } from "@/lib/games/node";
import { GuardError } from "@/lib/server/guard";
import { loadUser, postSystemMessageAdmin, sendPushTo } from "@/lib/server/push";

/**
 * Server-resolved moves (Hangman letters, Battleship shots): the admin SDK
 * reads the opponent's owner-only subtree at `gamePrivate/{id}/{uid}`, the
 * shared `games/{id}` node is rewritten in a transaction, and the pushes and
 * the result bookkeeping mirror what `lib/db/games.ts` does for client moves.
 */

const gameRef = (id: string) => adminRtdb().ref(`games/${id}`);

export interface OpenGame {
  game: GameNode;
  /** Every `gamePrivate/{id}/{uid}` subtree, keyed by uid; only ever read here, never returned to a client. */
  privates: Record<string, unknown>;
  /** Rewrite the node atomically from the cached value (one round trip); `fn` returns undefined to abort (409). */
  commit(fn: (current: GameNode) => GameNode | undefined): Promise<GameNode>;
  /** Drop the listener without committing. */
  close(): void;
}

/**
 * Open a game for one server move: the shared node and every private subtree
 * are fetched in parallel (one round trip), and a value listener keeps the
 * node cached so the transaction starts from it and commits in one round
 * trip instead of first running against null and rerunning after the server
 * sends the value. Call `commit` or `close` exactly once.
 */
export async function openGame(id: string): Promise<OpenGame> {
  const ref = gameRef(id);
  const keep = () => undefined;
  ref.on("value", keep);
  const close = () => ref.off("value", keep);
  try {
    const [snap, priv] = await Promise.all([ref.once("value"), adminRtdb().ref(`gamePrivate/${id}`).get()]);
    if (!snap.exists()) throw new GuardError(404, "not_found");
    return {
      game: snap.val() as GameNode,
      privates: (priv.val() as Record<string, unknown> | null) ?? {},
      close,
      commit: async (fn) => {
        try {
          const res = await ref.transaction((current: GameNode | null) => (current === null ? current : fn(current)));
          if (!res.committed || !res.snapshot.exists()) throw new GuardError(409, "move_rejected");
          return res.snapshot.val() as GameNode;
        } finally {
          close();
        }
      },
    };
  } catch (e) {
    close();
    throw e;
  }
}

/** The finishing fields every server move sets when the game is over. */
export function finishedFields(winnerId: string): Pick<GameNode, "status" | "open" | "finishedAt" | "winnerId" | "endReason"> {
  return { status: "finished", open: true, finishedAt: Date.now(), winnerId, endReason: "win" };
}

/**
 * After a committed server move: a your-turn push when the move handed the
 * turn over, or the result bookkeeping (gameResults, pair.records, the chat
 * line, the result push) when it ended the game. Routes run it in `after()`,
 * once the response has gone out: none of it is on the tap → board path.
 */
export async function afterServerMove(id: string, before: GameNode, after: GameNode, callerUid: string, turnBody: string): Promise<void> {
  const url = `/play/${id}`;
  const me = await loadUser(callerUid);
  const myName = me.nickname || "Your friend";
  if (after.status === "finished") {
    await recordResultAdmin(id, after, callerUid);
    return;
  }
  const next = uidOf(after, after.turn);
  if (next !== callerUid && (uidOf(before, before.turn) !== next || before.status !== "active")) {
    await sendPushTo(next, "yourTurn", { senderName: myName, payload: { body: turnBody, data: { url } }, skipWhenOnPage: url });
  }
}

async function recordResultAdmin(id: string, game: GameNode, by: string): Promise<void> {
  const db = adminDb();
  try {
    await db.doc(`gameResults/${id}`).create({
      game: game.type,
      players: [game.players.first, game.players.second],
      winnerId: game.winnerId,
      endReason: game.endReason ?? "win",
      startedAt: Timestamp.fromMillis(game.createdAt || Date.now()),
      endedAt: FieldValue.serverTimestamp(),
      moves: game.moves ?? 0,
    });
  } catch {
    return; // already recorded
  }
  const pairRef = db.doc("pair/main");
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(pairRef);
    const records = { ...((snap.data()?.records as Record<string, Record<string, number>> | undefined) ?? {}) };
    const rec = { ...(records[game.type] ?? {}) };
    if (game.winnerId) rec[game.winnerId] = (rec[game.winnerId] ?? 0) + 1;
    else rec.draws = (rec.draws ?? 0) + 1;
    records[game.type] = rec;
    tx.update(pairRef, { records });
  });
  const [first, second] = await Promise.all([loadUser(game.players.first), loadUser(game.players.second)]);
  const nameOf = (uid: string) => (uid === game.players.first ? first.nickname : second.nickname) || "Friend";
  await postSystemMessageAdmin(by, "game-result", describeResult(game, nameOf), { game: gameInfo(game.type).name });
  const opponent = opponentOf(game, by);
  await sendPushTo(opponent, "yourTurn", { senderName: nameOf(by), payload: { body: resultForRecipient(game, opponent, nameOf), data: { url: `/play/${id}` } } });
}
