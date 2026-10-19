/** Shared deck state at RTDB cards/{deck}. Either person flips; responses are keyed by uid. */

import { deckSize, type DeckKind } from "@/lib/decks";
import { getRtdb } from "@/lib/firebase/client";
import { onValue, ref, runTransaction, serverTimestamp, set, update } from "@/lib/firebase/rt";
import { randomSeed } from "@/lib/seeded";

export interface DeckNode {
  seed: number;
  index: number;
  flippedBy: string;
  at: number;
  /** uid → "A" | "B" (wyr) · "have" | "never" (nhie) · "done" (tod) */
  responses?: Record<string, string>;
  /** Running tallies that survive flips. */
  tally?: { agreed?: number; compared?: number; points?: Record<string, number> };
  /** Truth-or-dare only. */
  turn?: string;
  pick?: "truth" | "dare";
}

const deckRef = (kind: DeckKind) => ref(getRtdb(), `cards/${kind}`);

export function subscribeDeck(kind: DeckKind, cb: (node: DeckNode | null) => void): () => void {
  return onValue(deckRef(kind), (snap) => cb(snap.exists() ? (snap.val() as DeckNode) : null));
}

/** Next card; reseeds when the shuffle is exhausted. Tallies carry over, responses reset. */
export function flipNext(kind: DeckKind, uid: string, extra: Partial<DeckNode> = {}): Promise<void> {
  const n = deckSize(kind);
  return runTransaction(deckRef(kind), (cur: DeckNode | null) => {
    const base: DeckNode = cur ?? { seed: randomSeed(), index: -1, flippedBy: uid, at: 0 };
    let { seed, index } = base;
    index += 1;
    if (index >= n) {
      seed = randomSeed();
      index = 0;
    }
    return { ...base, seed, index, flippedBy: uid, at: Date.now(), responses: null, pick: null, ...extra, tally: base.tally ?? null } as unknown as DeckNode;
  }).then(() => undefined);
}

export function respond(kind: DeckKind, uid: string, value: string): Promise<void> {
  return update(deckRef(kind), { [`responses/${uid}`]: value, at: serverTimestamp() });
}

/** Called once per card when both have answered; idempotent via `tally.compared` bookkeeping on the caller. */
export function bumpTally(kind: DeckKind, patch: { agreed?: number; compared?: number; points?: Record<string, number> }): Promise<void> {
  return runTransaction(deckRef(kind), (cur: DeckNode | null) => {
    if (!cur) return cur;
    const t = cur.tally ?? {};
    const points = { ...(t.points ?? {}) };
    for (const [u, p] of Object.entries(patch.points ?? {})) points[u] = (points[u] ?? 0) + p;
    return { ...cur, tally: { agreed: (t.agreed ?? 0) + (patch.agreed ?? 0), compared: (t.compared ?? 0) + (patch.compared ?? 0), points } };
  }).then(() => undefined);
}

/** Fresh seed, index 0, tallies and responses cleared. */
export function resetDeck(kind: DeckKind, uid: string): Promise<void> {
  const node: DeckNode = { seed: randomSeed(), index: 0, flippedBy: uid, at: Date.now(), turn: uid };
  return set(deckRef(kind), node);
}

export function setPick(kind: DeckKind, pick: "truth" | "dare", turn: string): Promise<void> {
  return update(deckRef(kind), { pick, turn });
}
