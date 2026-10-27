/** Pictionary rules that need no Firebase: round counts, scoring and the round-advance patch. */

export const ROUND_MS = 60_000;
export const ROUND_OPTIONS = [3, 5] as const;
export type RoundCount = (typeof ROUND_OPTIONS)[number];
export const DEFAULT_ROUNDS: RoundCount = 3;

/** Rounds a stored game plays: older nodes (no `rounds`) and anything odd fall back to 3. */
export const roundsOf = (g: { rounds?: number } | null | undefined): RoundCount => (g?.rounds === 5 ? 5 : DEFAULT_ROUNDS);

/** Points scale with time left: 1–10 for the guesser, half (rounded up) for the drawer. */
export function pointsFor(msLeft: number): number {
  return Math.max(1, Math.ceil((Math.max(0, msLeft) / ROUND_MS) * 10));
}

export interface RoundState {
  players: { first: string; second: string };
  status: string;
  round: number;
  rounds?: number;
  drawerUid: string;
  roundOver: boolean;
}

/**
 * What `nextRound` writes, computed inside a transaction from the *current*
 * node: null when the tap is stale (the round already advanced, the round
 * isn't over, or the game isn't active), so two taps can never skip a round.
 */
export function advanceRound(cur: RoundState | null, fromRound: number, offer: () => string): Record<string, unknown> | null {
  if (!cur || cur.status !== "active" || !cur.roundOver || cur.round !== fromRound) return null;
  if (cur.round >= roundsOf(cur)) return { status: "finished", open: false, strokes: null, live: null };
  const drawerUid = cur.drawerUid === cur.players.first ? cur.players.second : cur.players.first;
  return { round: cur.round + 1, drawerUid, wordOptions: offer(), word: null, roundStartedAt: 0, guesses: "[]", solvedAt: null, solvedBy: null, roundOver: false, strokes: null, live: null };
}
