/**
 * Live games in RTDB (games/{id}), results in Firestore, records on pair/main.
 * State is stored as a JSON string so RTDB's array quirks never bite.
 */
import { onValue, orderByChild, push as rtdbPush, query as rtdbQuery, ref, runTransaction, serverTimestamp as rtdbNow, equalTo, update } from "firebase/database";


import { postSystemMessage } from "@/lib/db/home";
import { pairRef } from "@/lib/db/refs";
import { getDb, getRtdb } from "@/lib/firebase/client";
import { collection, doc, getDocs, limit, orderBy, query, runTransaction as fsTransaction, serverTimestamp, setDoc, Timestamp, type CollectionReference, type Query } from "@/lib/firebase/fs";
import { GAME_META, initialStateFor, loadEngine, other, type GameType, type Player } from "@/lib/games";
import { recordTogetherEvent } from "@/lib/garden";
import { notify } from "@/lib/notify";
import { swallow } from "@/lib/swallow";
import type { PairDoc } from "@/lib/types";
type GameStatusKey = "invited" | "active" | "finished" | "declined";
type EndReason = "win" | "draw" | "resign" | "abandoned" | "cancelled";

export interface GameNode {
  type: GameType;
  /** JSON of the engine state. */
  state: string;
  turn: Player;
  players: { first: string; second: string };
  status: GameStatusKey;
  /** True while not finished/declined; indexed for the landing query. */
  open: boolean;
  createdBy: string;
  createdAt: number;
  lastMoveAt: number;
  moves: number;
  winnerId: string | null;
  endReason: EndReason | null;
  rematchOf?: string;
  /** Set when finished; the game stays listed (open) for a few hours, then the tick closes it. */
  finishedAt?: number;
  /** Latest quick reaction from either player; clients animate on `at` change. */
  reaction?: { by: string; emoji: string; at: number };
}

export const GAME_REACTIONS = ["👏", "😱", "🤔", "😂"] as const;

export const isLive = (g: GameNode) => g.status === "invited" || g.status === "active";

export interface LiveGame extends GameNode {
  id: string;
}

export interface GameResultDoc {
  game: GameType;
  players: string[];
  winnerId: string | null;
  endReason: EndReason;
  startedAt: Timestamp;
  endedAt: Timestamp | null;
  moves: number;
}

const gamePath = (id: string) => `games/${id}`;
export const gameRoute = (id: string) => `/play/${id}`;
const gamesRef = () => ref(getRtdb(), "games");

/** Open (invited or active) games — the only landing listener. */
export function subscribeOpenGames(cb: (games: LiveGame[]) => void): () => void {
  const q = rtdbQuery(gamesRef(), orderByChild("open"), equalTo(true));
  return onValue(q, (snap) => {
    const list: LiveGame[] = [];
    snap.forEach((c) => {
      list.push({ id: c.key as string, ...(c.val() as GameNode) });
    });
    cb(list.sort((a, b) => b.lastMoveAt - a.lastMoveAt));
  });
}

export function subscribeGame(id: string, cb: (game: LiveGame | null) => void): () => void {
  return onValue(ref(getRtdb(), gamePath(id)), (snap) => cb(snap.exists() ? { id, ...(snap.val() as GameNode) } : null));
}

export const uidOf = (g: GameNode, p: Player) => (p === "first" ? g.players.first : g.players.second);
export const playerOf = (g: GameNode, uid: string): Player | null => (g.players.first === uid ? "first" : g.players.second === uid ? "second" : null);

/* ── lobby ─────────────────────────────────────────────────────────────── */

export async function inviteGame(type: GameType, me: string, friend: string): Promise<string> {
  const node = rtdbPush(gamesRef());
  const now = Date.now();
  const g: GameNode = {
    type,
    state: JSON.stringify(initialStateFor(type)),
    turn: "first",
    players: { first: me, second: friend },
    status: "invited",
    open: true,
    createdBy: me,
    createdAt: now,
    lastMoveAt: now,
    moves: 0,
    winnerId: null,
    endReason: null,
  };
  await update(node, { ...g, createdAt: rtdbNow(), lastMoveAt: rtdbNow() });
  void notify("invite", { toUid: friend, body: `wants to play ${GAME_META[type].name} ${GAME_META[type].emoji}`, data: { url: gameRoute(node.key as string) } });
  return node.key as string;
}

export function acceptGame(id: string): Promise<void> {
  return update(ref(getRtdb(), gamePath(id)), { status: "active", lastMoveAt: rtdbNow() });
}

export function declineGame(id: string): Promise<void> {
  return update(ref(getRtdb(), gamePath(id)), { status: "declined", open: false, endReason: null });
}

/** Rematch: same two players, colours swapped, straight to active. */
export async function rematch(from: LiveGame): Promise<string> {
  const node = rtdbPush(gamesRef());
  const g: Omit<GameNode, "createdAt" | "lastMoveAt"> = {
    type: from.type,
    state: JSON.stringify(initialStateFor(from.type)),
    turn: "first",
    players: { first: from.players.second, second: from.players.first },
    status: "active",
    open: true,
    createdBy: from.players.first,
    moves: 0,
    winnerId: null,
    endReason: null,
    rematchOf: from.id,
  };
  await update(node, { ...g, createdAt: rtdbNow(), lastMoveAt: rtdbNow() });
  await update(ref(getRtdb(), gamePath(from.id)), { open: false });
  void notify("yourTurn", { toUid: from.players.second === g.players.first ? from.players.first : from.players.second, body: `Rematch at ${GAME_META[from.type].name}! ${g.players.first === from.players.second ? "You move first." : "They move first."}`, data: { url: gameRoute(node.key as string) } });
  return node.key as string;
}

/** A quick 👏 / 😱 / 🤔 / 😂 for the other player; both boards animate it. */
export function sendReaction(gameId: string, by: string, emoji: string): Promise<void> {
  return update(ref(getRtdb(), gamePath(gameId)), { reaction: { by, emoji, at: rtdbNow() } });
}

/* ── moves ─────────────────────────────────────────────────────────────── */

export interface MoveOutcome {
  finished: boolean;
  winnerId: string | null;
  endReason: EndReason | null;
}

/**
 * Apply a move inside an RTDB transaction so two devices can't both move.
 * The client that makes the final move also records the result.
 */
export async function playMove(game: LiveGame, me: string, move: unknown, nameOf: (uid: string) => string): Promise<MoveOutcome> {
  const engine = await loadEngine(game.type);
  let outcome: MoveOutcome = { finished: false, winnerId: null, endReason: null };
  const res = await runTransaction(ref(getRtdb(), gamePath(game.id)), (current: GameNode | null) => {
    if (!current || current.status !== "active") return;
    const state = JSON.parse(current.state);
    const mover = engine.mover(state);
    if (uidOf(current, mover) !== me) return;
    const legal = engine.legalMoves(state).some((m: unknown) => JSON.stringify(m) === JSON.stringify(move));
    if (!legal) return;
    const next = engine.applyMove(state, move);
    const st = engine.status(next);
    const finished = st.status !== "ongoing";
    const winnerId = st.status === "win" && st.winner ? uidOf(current, st.winner) : null;
    outcome = { finished, winnerId, endReason: finished ? (st.status === "win" ? "win" : "draw") : null };
    return {
      ...current,
      state: JSON.stringify(next),
      turn: engine.mover(next),
      moves: (current.moves ?? 0) + 1,
      lastMoveAt: Date.now(),
      status: finished ? "finished" : "active",
      open: true,
      ...(finished ? { finishedAt: Date.now() } : {}),
      winnerId,
      endReason: outcome.endReason,
    } satisfies GameNode;
  });
  if (!res.committed) throw new Error("move_rejected");
  const after = { id: game.id, ...(res.snapshot.val() as GameNode) };
  if (outcome.finished) await recordResult(after, me, nameOf);
  else void notify("yourTurn", { toUid: uidOf(after, after.turn), body: `Your move in ${GAME_META[after.type].name} ${GAME_META[after.type].emoji}`, data: { url: gameRoute(after.id) } });
  return outcome;
}

/** A game nobody has moved in yet can be called off: no result, no record change. */
export async function cancelGame(game: LiveGame, me: string, nameOf: (uid: string) => string): Promise<boolean> {
  const res = await runTransaction(ref(getRtdb(), gamePath(game.id)), (current: GameNode | null) => {
    if (!current || current.status !== "active" || (current.moves ?? 0) > 0) return;
    return { ...current, status: "finished", open: false, winnerId: null, endReason: "cancelled", lastMoveAt: Date.now() } satisfies GameNode;
  });
  if (res.committed) void postSystemMessage(me, `✕ ${nameOf(me)} cancelled the ${GAME_META[game.type].name} game`);
  return res.committed;
}

export async function resign(game: LiveGame, me: string, nameOf: (uid: string) => string): Promise<void> {
  const mine = playerOf(game, me);
  if (!mine) return;
  const winnerId = uidOf(game, other(mine));
  const res = await runTransaction(ref(getRtdb(), gamePath(game.id)), (current: GameNode | null) => {
    if (!current || current.status !== "active") return;
    return { ...current, status: "finished", open: true, finishedAt: Date.now(), winnerId, endReason: "resign", lastMoveAt: Date.now() } satisfies GameNode;
  });
  if (res.committed) await recordResult({ id: game.id, ...(res.snapshot.val() as GameNode) }, me, nameOf);
}

/* ── results & records ─────────────────────────────────────────────────── */

const resultsCol = () => collection(getDb(), "gameResults") as CollectionReference<GameResultDoc>;
const recentResultsQuery = (): Query<GameResultDoc> => query(resultsCol(), orderBy("endedAt", "desc"), limit(20));

export async function loadRecentResults(): Promise<Array<GameResultDoc & { id: string }>> {
  const snap = await getDocs(recentResultsQuery());
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * gameResults/{gameId} (create-only, so a second finaliser is a harmless no-op),
 * pair/main.records[game] in a transaction, confetti is the caller's, and a
 * system line in chat.
 */
async function recordResult(game: LiveGame, by: string, nameOf: (uid: string) => string): Promise<void> {
  const players = [game.players.first, game.players.second];
  const resultRef = doc(resultsCol(), game.id);
  try {
    await setDoc(resultRef, {
      game: game.type,
      players,
      winnerId: game.winnerId,
      endReason: game.endReason ?? "win",
      startedAt: Timestamp.fromMillis(game.createdAt || Date.now()),
      endedAt: serverTimestamp(),
      moves: game.moves ?? 0,
    });
  } catch {
    return; // already recorded by the other client
  }
  await fsTransaction(getDb(), async (tx) => {
    const snap = await tx.get(pairRef());
    const pair = snap.data() as PairDoc | undefined;
    const records = { ...(pair?.records ?? {}) };
    const rec = { ...(records[game.type] ?? {}) };
    if (game.winnerId) rec[game.winnerId] = (rec[game.winnerId] ?? 0) + 1;
    else rec.draws = (rec.draws ?? 0) + 1;
    records[game.type] = rec;
    tx.update(pairRef(), { records });
  }).catch(swallow);
  void postSystemMessage(by, describeResult(game, nameOf));
  if (game.winnerId && game.type === "chess") void recordTogetherEvent("chess-win", by);
  if (game.winnerId && game.type === "connectfour") void recordTogetherEvent("c4-win", by);
  const opponent = game.players.first === by ? game.players.second : game.players.first;
  void notify("yourTurn", { toUid: opponent, body: resultForRecipient(game, opponent, nameOf), data: { url: gameRoute(game.id) } });
}

/** "Priya resigned at Chess — you win 🎉" / "Checkmate — Priya wins at Chess" / "Draw at Chess". */
export function resultForRecipient(game: LiveGame, recipient: string, nameOf: (uid: string) => string): string {
  const meta = GAME_META[game.type];
  const otherUid = game.players.first === recipient ? game.players.second : game.players.first;
  if (!game.winnerId) return `${meta.emoji} Draw at ${meta.name}`;
  const won = game.winnerId === recipient;
  if (game.endReason === "resign") return won ? `${meta.emoji} ${nameOf(otherUid)} resigned at ${meta.name} — you win 🎉` : `${meta.emoji} You resigned at ${meta.name}`;
  return won ? `${meta.emoji} You won at ${meta.name} 🎉` : `${meta.emoji} ${nameOf(otherUid)} won at ${meta.name}`;
}

/** Nickname-aware line, posted from the UI where names are known. */
export function describeResult(game: LiveGame, nameOf: (uid: string) => string): string {
  const meta = GAME_META[game.type];
  if (game.endReason === "cancelled") return `✕ The ${meta.name} game was cancelled`;
  if (!game.winnerId) return `${meta.emoji} ${nameOf(game.players.first)} and ${nameOf(game.players.second)} drew at ${meta.name}`;
  const loser = game.winnerId === game.players.first ? game.players.second : game.players.first;
  if (game.endReason === "resign") return `${meta.emoji} ${nameOf(loser)} conceded at ${meta.name} — ${nameOf(game.winnerId)} takes it`;
  return `${meta.emoji} ${nameOf(game.winnerId)} beat ${nameOf(loser)} at ${meta.name}`;
}

/** The record strip: wins per uid and draws, from pair/main. */
export function recordFor(pair: Pick<PairDoc, "records">, type: GameType, me: string, friend: string | null) {
  const r = pair.records?.[type] ?? {};
  return { mine: r[me] ?? 0, theirs: friend ? (r[friend] ?? 0) : 0, draws: r.draws ?? 0 };
}

/** Results for non-board games (trivia): gameResults doc + pair.records bump + chat line. */
export async function recordGenericResult(game: string, players: string[], winnerId: string | null, startedAtMs: number, moves: number, nameOf: (uid: string) => string): Promise<void> {
  const id = `${game}-${startedAtMs}`;
  try {
    await setDoc(doc(resultsCol(), id), { game: game as GameType, players, winnerId, endReason: winnerId ? "win" : "draw", startedAt: Timestamp.fromMillis(startedAtMs), endedAt: serverTimestamp(), moves });
  } catch {
    return;
  }
  await fsTransaction(getDb(), async (tx) => {
    const snap = await tx.get(pairRef());
    const pair = snap.data() as PairDoc | undefined;
    const records = { ...(pair?.records ?? {}) };
    const rec = { ...(records[game] ?? {}) };
    if (winnerId) rec[winnerId] = (rec[winnerId] ?? 0) + 1;
    else rec.draws = (rec.draws ?? 0) + 1;
    records[game] = rec;
    tx.update(pairRef(), { records });
  }).catch(swallow);
  const [host] = players;
  if (host === undefined) return;
  void postSystemMessage(host, winnerId ? `🧠 ${nameOf(winnerId)} won the trivia duel` : "🧠 The trivia duel was a tie");
  if (game === "trivia") void recordTogetherEvent("trivia", host);
}
