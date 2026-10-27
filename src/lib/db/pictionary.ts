/** Pictionary rounds at RTDB pictionary/{id}; strokes live under pictionary/{id}/strokes. */

import words from "@/content/pictionary-words.json";
import { getRtdb } from "@/lib/firebase/client";
import { equalTo, onValue, orderByChild, push, query, ref, runTransaction, serverTimestamp, set, update } from "@/lib/firebase/rt";
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

const r = (p: string) => ref(getRtdb(), p);
export const pictRoute = (id: string) => `/play/pictionary/${id}`;

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

export function subscribeOpenPictionary(cb: (list: LivePictionary[]) => void): () => void {
  return onValue(query(r("pictionary"), orderByChild("open"), equalTo(true)), (snap) => {
    const list: LivePictionary[] = [];
    snap.forEach((c) => {
      const v = c.val() as PictionaryNode & { strokes?: unknown; live?: unknown };
      list.push({ id: c.key as string, ...v });
    });
    cb(list.sort((a, b) => b.createdAt - a.createdAt));
  });
}

export function subscribePictionary(id: string, cb: (n: LivePictionary | null) => void): () => void {
  return onValue(r(`pictionary/${id}`), (snap) => {
    if (!snap.exists()) return cb(null);
    const v = snap.val() as PictionaryNode;
    cb({ id, ...v });
  });
}

export async function invitePictionary(me: string, friend: string, rounds: RoundCount = DEFAULT_ROUNDS): Promise<string> {
  const node = push(r("pictionary"));
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

export const acceptPictionary = (id: string) => update(r(`pictionary/${id}`), { status: "active" });
export const declinePictionary = (id: string) => update(r(`pictionary/${id}`), { status: "declined", open: false });

/** The round clock is server time, so neither phone's clock can end a round early or late. */
export function chooseWord(id: string, word: string): Promise<void> {
  return update(r(`pictionary/${id}`), { word, roundStartedAt: serverTimestamp(), guesses: "[]", solvedAt: null, solvedBy: null, roundOver: false });
}

/** Append a guess; on a match award points inside the same transaction. `nowMs` is server time (RTDB offset applied). */
export async function submitGuess(game: LivePictionary, uid: string, text: string, nowMs: number): Promise<boolean> {
  let solved = false;
  await runTransaction(r(`pictionary/${game.id}`), (cur: PictionaryNode | null) => {
    if (!cur || cur.status !== "active" || !cur.word || cur.roundOver) return cur;
    const list = parseGuesses(cur);
    list.push({ uid, text: text.trim().slice(0, 60), at: nowMs });
    const hit = normalise(text) === normalise(cur.word);
    if (!hit) return { ...cur, guesses: JSON.stringify(list) };
    const left = Math.max(0, cur.roundStartedAt + ROUND_MS - nowMs);
    const pts = pointsFor(left);
    const scores = { ...cur.scores };
    scores[uid] = (scores[uid] ?? 0) + pts;
    scores[cur.drawerUid] = (scores[cur.drawerUid] ?? 0) + Math.ceil(pts / 2);
    solved = true;
    return { ...cur, guesses: JSON.stringify(list), solvedAt: nowMs, solvedBy: uid, scores, roundOver: true };
  });
  return solved;
}

export const endRound = (id: string) => update(r(`pictionary/${id}`), { roundOver: true });

/**
 * Next round (or finish after the last): clears the canvas, swaps the drawer,
 * offers new words. A transaction from the round the tapper saw, so a stale
 * or double tap (both phones press "Next round") is a no-op, never a skip.
 */
export async function nextRound(game: LivePictionary): Promise<void> {
  await runTransaction(r(`pictionary/${game.id}`), (cur: PictionaryNode | null) => {
    const patch = advanceRound(cur, game.round, offer);
    return patch ? { ...cur, ...patch } : undefined;
  });
}

export const closePictionary = (id: string) => update(r(`pictionary/${id}`), { open: false });
