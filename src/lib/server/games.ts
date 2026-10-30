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

export async function loadGame(id: string): Promise<GameNode> {
  const snap = await gameRef(id).get();
  if (!snap.exists()) throw new GuardError(404, "not_found");
  return snap.val() as GameNode;
}

export async function loadPrivate<T>(id: string, uid: string): Promise<T | null> {
  const snap = await adminRtdb().ref(`gamePrivate/${id}/${uid}`).get();
  return snap.exists() ? (snap.val() as T) : null;
}

/** Rewrite the node atomically; `fn` returns undefined to abort (409 to the caller). */
export async function transactGame(id: string, fn: (current: GameNode) => GameNode | undefined): Promise<GameNode> {
  const res = await gameRef(id).transaction((current: GameNode | null) => {
    // The first pass may see null before the SDK has the value: hand it back so the compare fails and reruns.
    if (current === null) return current;
    return fn(current);
  });
  if (!res.committed || !res.snapshot.exists()) throw new GuardError(409, "move_rejected");
  return res.snapshot.val() as GameNode;
}

/** The finishing fields every server move sets when the game is over. */
export function finishedFields(winnerId: string): Pick<GameNode, "status" | "open" | "finishedAt" | "winnerId" | "endReason"> {
  return { status: "finished", open: true, finishedAt: Date.now(), winnerId, endReason: "win" };
}

/**
 * After a committed server move: a your-turn push when the move handed the
 * turn over, or the result bookkeeping (gameResults, pair.records, the chat
 * line, the result push) when it ended the game.
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
