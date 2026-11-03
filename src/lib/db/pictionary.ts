/**
 * Pictionary rounds at RTDB pictionary/{id}. Strokes and the live in-progress
 * stroke live in the sibling node pictionaryStrokes/{id} (`lib/db/together`),
 * never under the round node: a transaction retries whenever anything under
 * its path changes, and the drawer streams a point every 80 ms, so a round
 * transaction sharing the node with the canvas hit `maxretry` mid-drawing.
 */

import words from "@/content/pictionary-words.json";
import { getRtdb } from "@/lib/firebase/client";
import { equalTo, onValue, orderByChild, push, query, ref, remove, runTransaction, serverTimestamp, set, update, type Database } from "@/lib/firebase/rt";
import { advanceRound, DEFAULT_ROUNDS, pointsFor, ROUND_MS, type RoundCount } from "@/lib/pictionary";

export { ROUND_MS, ROUND_OPTIONS, roundsOf } from "@/lib/pictionary";

export interface Guess {
  uid: string;
  text: string;
  at: number;
}

export interface PictionaryNode {
  players: { first: string; second: string };
  status: "invited" | "active" | "finished" | "declined";
  open: boolean;
  createdBy: string;
  createdAt: number;
  round: number;
  /** 3 or 5; absent on games from before it was selectable (= 3). */
  rounds?: number;
  drawerUid: string;
  /** JSON string[] of the 3 offered words. */
  wordOptions: string;
  word: string | null;
  roundStartedAt: number;
  /** JSON Guess[] */
  guesses: string;
  scores: Record<string, number>;
  solvedAt: number | null;
  solvedBy: string | null;
  roundOver: boolean;
}
export interface LivePictionary extends PictionaryNode {
  id: string;
}

const r = (p: string, db: Database = getRtdb()) => ref(db, p);
export const pictRoute = (id: string) => `/play/pictionary/${id}`;
/** The canvas node for a game: the `base` SharedCanvas draws on. */
export const pictStrokesBase = (id: string) => `pictionaryStrokes/${id}`;

const offer = () => {
  const picks = new Set<string>();
  while (picks.size < 3) picks.add(words[Math.floor(Math.random() * words.length)]!);
  return JSON.stringify(Array.from(picks));
};
const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
export const parseGuesses = (n: PictionaryNode | null): Guess[] => {
  try {
    return n?.guesses ? (JSON.parse(n.guesses) as Guess[]) : [];
  } catch {
    return [];
  }
};
export const parseOptions = (n: PictionaryNode | null): string[] => {
  try {
    return n?.wordOptions ? (JSON.parse(n.wordOptions) as string[]) : [];
  } catch {
    return [];
  }
};

/** Games from before the move may still carry a canvas under the round node; a rewrite drops it (the rules refuse it now). */
function withoutCanvas<T extends object>(node: T): T {
  const copy = { ...node } as Record<string, unknown>;
  delete copy.strokes;
  delete copy.live;
  return copy as T;
}

export function subscribeOpenPictionary(cb: (list: LivePictionary[]) => void, db?: Database): () => void {
  return onValue(query(r("pictionary", db), orderByChild("open"), equalTo(true)), (snap) => {
    const list: LivePictionary[] = [];
    snap.forEach((c) => {
      list.push({ id: c.key as string, ...withoutCanvas(c.val() as PictionaryNode) });
    });
    cb(list.sort((a, b) => b.createdAt - a.createdAt));
  });
}

export function subscribePictionary(id: string, cb: (n: LivePictionary | null) => void, db?: Database): () => void {
  return onValue(r(`pictionary/${id}`, db), (snap) => {
    if (!snap.exists()) return cb(null);
    cb({ id, ...withoutCanvas(snap.val() as PictionaryNode) });
  });
}

export async function invitePictionary(me: string, friend: string, rounds: RoundCount = DEFAULT_ROUNDS, db?: Database): Promise<string> {
  const node = push(r("pictionary", db));
  const data: Omit<PictionaryNode, "createdAt"> = {
    players: { first: me, second: friend },
    status: "invited",
    open: true,
    createdBy: me,
    round: 1,
    rounds,
    drawerUid: me,
    wordOptions: offer(),
    word: null,
    roundStartedAt: 0,
    guesses: "[]",
    scores: { [me]: 0, [friend]: 0 },
    solvedAt: null,
    solvedBy: null,
    roundOver: false,
  };
  await set(node, { ...data, createdAt: serverTimestamp() });
  // The invite card, toast and push come from `startInvite` in the caller (PictionaryLobby).
  return node.key as string;
}

export const acceptPictionary = (id: string, db?: Database) => update(r(`pictionary/${id}`, db), { status: "active" });
export const declinePictionary = (id: string, db?: Database) => update(r(`pictionary/${id}`, db), { status: "declined", open: false });

/** The round clock is server time, so neither phone's clock can end a round early or late. */
export function chooseWord(id: string, word: string, db?: Database): Promise<void> {
  return update(r(`pictionary/${id}`, db), { word, roundStartedAt: serverTimestamp(), guesses: "[]", solvedAt: null, solvedBy: null, roundOver: false });
}

/** Append a guess; on a match award points inside the same transaction. `nowMs` is server time (RTDB offset applied). */
export async function submitGuess(game: LivePictionary, uid: string, text: string, nowMs: number, db?: Database): Promise<boolean> {
  let solved = false;
  await runTransaction(r(`pictionary/${game.id}`, db), (cur: PictionaryNode | null) => {
    if (!cur || cur.status !== "active" || !cur.word || cur.roundOver) return cur;
    const list = parseGuesses(cur);
    list.push({ uid, text: text.trim().slice(0, 60), at: nowMs });
    const hit = normalise(text) === normalise(cur.word);
    if (!hit) return withoutCanvas({ ...cur, guesses: JSON.stringify(list) });
    const left = Math.max(0, cur.roundStartedAt + ROUND_MS - nowMs);
    const pts = pointsFor(left);
    const scores = { ...cur.scores };
    scores[uid] = (scores[uid] ?? 0) + pts;
    scores[cur.drawerUid] = (scores[cur.drawerUid] ?? 0) + Math.ceil(pts / 2);
    solved = true;
    return withoutCanvas({ ...cur, guesses: JSON.stringify(list), solvedAt: nowMs, solvedBy: uid, scores, roundOver: true });
  });
  return solved;
}

export const endRound = (id: string, db?: Database) => update(r(`pictionary/${id}`, db), { roundOver: true });

/**
 * Next round (or finish after the last): swaps the drawer, offers new words,
 * then clears the canvas node. A transaction from the round the tapper saw, so
 * a stale or double tap (both phones press "Next round") is a no-op, never a
 * skip. Resolves true when this tap advanced the round. Rejects (`maxretry`
 * after 25 contested attempts, or a rules refusal) are the caller's to show.
 */
export async function nextRound(game: LivePictionary, db?: Database): Promise<boolean> {
  let advanced = false;
  const res = await runTransaction(r(`pictionary/${game.id}`, db), (cur: PictionaryNode | null) => {
    if (cur === null) return null; // nothing cached yet (no listener): the SDK retries with the server value
    const patch = advanceRound(cur, game.round, offer);
    if (!patch) return undefined; // stale tap: abort
    advanced = true;
    return withoutCanvas({ ...cur, ...patch });
  });
  const done = advanced && res.committed;
  if (done) await remove(r(pictStrokesBase(game.id), db));
  return done;
}

/** Unlist a finished game and drop its canvas. */
export async function closePictionary(id: string, db?: Database): Promise<void> {
  await update(r(`pictionary/${id}`, db), { open: false });
  await remove(r(pictStrokesBase(id), db));
}
