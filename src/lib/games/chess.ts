import { Chess, type Move, type Square } from "chess.js";

import { type Engine, type GameStatus, type Player } from "@/lib/games/types";

/** FEN plus SAN history. First = white. */
export interface ChessState {
  fen: string;
  history: string[];
  lastMove: { from: string; to: string } | null;
}
export interface ChessMove {
  from: Square;
  to: Square;
  promotion?: "q" | "r" | "b" | "n";
}

function load(state: ChessState): Chess {
  return new Chess(state.fen);
}

function status(state: ChessState): GameStatus {
  const c = load(state);
  if (c.isCheckmate()) return { status: "win", winner: c.turn() === "w" ? "second" : "first" };
  if (c.isDraw() || c.isStalemate()) return { status: "draw" };
  return { status: "ongoing" };
}

export const chess: Engine<ChessState, ChessMove> = {
  type: "chess",
  initialState: () => ({ fen: new Chess().fen(), history: [], lastMove: null }),
  mover: (s): Player => (load(s).turn() === "w" ? "first" : "second"),
  status,
  legalMoves(state) {
    if (status(state).status !== "ongoing") return [];
    return load(state)
      .moves({ verbose: true })
      .map((m: Move) => ({ from: m.from, to: m.to, ...(m.promotion ? { promotion: m.promotion as ChessMove["promotion"] } : {}) }));
  },
  applyMove(state, move) {
    const c = load(state);
    const made = c.move({ from: move.from, to: move.to, promotion: move.promotion ?? "q" });
    return { fen: c.fen(), history: [...(state.history ?? []), made.san], lastMove: { from: made.from, to: made.to } };
  },
};

/** Material captured by each side, from the FEN (for the captured-pieces row). */
export function capturedPieces(fen: string): { byFirst: string[]; bySecond: string[] } {
  const start: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, P: 8, N: 2, B: 2, R: 2, Q: 1 };
  const counts: Record<string, number> = {};
  for (const ch of fen.split(" ")[0] ?? "") if (/[pnbrqPNBRQ]/.test(ch)) counts[ch] = (counts[ch] ?? 0) + 1;
  const byFirst: string[] = [];
  const bySecond: string[] = [];
  for (const [piece, n] of Object.entries(start)) {
    const missing = n - (counts[piece] ?? 0);
    for (let i = 0; i < missing; i++) (piece === piece.toLowerCase() ? byFirst : bySecond).push(piece);
  }
  return { byFirst, bySecond };
}

export function inCheck(state: ChessState): boolean {
  return load(state).inCheck();
}

export const PIECE_GLYPH: Record<string, string> = { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙", k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
