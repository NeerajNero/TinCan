/** Pictionary rounds at RTDB pictionary/{id}; strokes live under pictionary/{id}/strokes. */
import { equalTo, onValue, orderByChild, push, query, ref, runTransaction, serverTimestamp, set, update } from "firebase/database";

import words from "@/content/pictionary-words.json";
import { getRtdb } from "@/lib/firebase/client";
import { notify } from "@/lib/notify";

export const ROUNDS = 3;
export const ROUND_MS = 60_000;

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
  while (picks.size < 3) picks.add(words[Math.floor(Math.random() * words.length)]);
  return JSON.stringify(Array.from(picks));
};
export const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
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

export async function invitePictionary(me: string, friend: string): Promise<string> {
  const node = push(r("pictionary"));
  const data: Omit<PictionaryNode, "createdAt"> = {
    players: { first: me, second: friend },
    status: "invited",
    open: true,
    createdBy: me,
    round: 1,
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
  void notify("invite", { toUid: friend, body: "wants to play Pictionary 🎨", data: { url: pictRoute(node.key as string) } });
  return node.key as string;
}

export const acceptPictionary = (id: string) => update(r(`pictionary/${id}`), { status: "active" });
export const declinePictionary = (id: string) => update(r(`pictionary/${id}`), { status: "declined", open: false });

export function chooseWord(id: string, word: string): Promise<void> {
  return update(r(`pictionary/${id}`), { word, roundStartedAt: Date.now(), guesses: "[]", solvedAt: null, solvedBy: null, roundOver: false });
}

/** Points scale with time left: 1–10 for the guesser, half (rounded up) for the drawer. */
export function pointsFor(msLeft: number): number {
  return Math.max(1, Math.ceil((msLeft / ROUND_MS) * 10));
}

/** Append a guess; on a match award points inside the same transaction. */
export async function submitGuess(game: LivePictionary, uid: string, text: string): Promise<boolean> {
  let solved = false;
  await runTransaction(r(`pictionary/${game.id}`), (cur: PictionaryNode | null) => {
    if (!cur || cur.status !== "active" || !cur.word || cur.roundOver) return cur;
    const list = parseGuesses(cur);
    list.push({ uid, text: text.trim().slice(0, 60), at: Date.now() });
    const hit = normalise(text) === normalise(cur.word);
    if (!hit) return { ...cur, guesses: JSON.stringify(list) };
    const left = Math.max(0, cur.roundStartedAt + ROUND_MS - Date.now());
    const pts = pointsFor(left);
    const scores = { ...cur.scores };
    scores[uid] = (scores[uid] ?? 0) + pts;
    scores[cur.drawerUid] = (scores[cur.drawerUid] ?? 0) + Math.ceil(pts / 2);
    solved = true;
    return { ...cur, guesses: JSON.stringify(list), solvedAt: Date.now(), solvedBy: uid, scores, roundOver: true };
  });
  return solved;
}

export const endRound = (id: string) => update(r(`pictionary/${id}`), { roundOver: true });

/** Next round (or finish after the third): clears the canvas, swaps the drawer, offers new words. */
export function nextRound(game: LivePictionary): Promise<void> {
  const base = r(`pictionary/${game.id}`);
  if (game.round >= ROUNDS) return update(base, { status: "finished", open: false, strokes: null, live: null });
  const drawerUid = game.drawerUid === game.players.first ? game.players.second : game.players.first;
  return update(base, { round: game.round + 1, drawerUid, wordOptions: offer(), word: null, roundStartedAt: 0, guesses: "[]", solvedAt: null, solvedBy: null, roundOver: false, strokes: null, live: null });
}

export const closePictionary = (id: string) => update(r(`pictionary/${id}`), { open: false });
