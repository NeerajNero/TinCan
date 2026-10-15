import { type Engine, type GameStatus, type Player } from "@/lib/games/types";

export const C4_COLS = 7;
export const C4_ROWS = 6;

/** board: 42 chars row-major, row 0 at the top; 'R' first, 'Y' second. */
export interface C4State {
  board: string;
  /** Index of the last dropped disc, for the drop animation. */
  last: number | null;
}
export type C4Move = number; // column

const idx = (r: number, c: number) => r * C4_COLS + c;
const mark = (p: Player) => (p === "first" ? "R" : "Y");

function mover(state: C4State): Player {
  const filled = state.board.replace(/\./g, "").length;
  return filled % 2 === 0 ? "first" : "second";
}

function landingRow(board: string, col: number): number {
  for (let r = C4_ROWS - 1; r >= 0; r--) if (board[idx(r, col)] === ".") return r;
  return -1;
}

function status(state: C4State): GameStatus {
  const b = state.board;
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < C4_ROWS; r++) {
    for (let c = 0; c < C4_COLS; c++) {
      const ch = b[idx(r, c)];
      if (ch === ".") continue;
      for (const [dr, dc] of dirs) {
        const line = [idx(r, c)];
        for (let k = 1; k < 4; k++) {
          const rr = r + dr * k;
          const cc = c + dc * k;
          if (rr < 0 || rr >= C4_ROWS || cc < 0 || cc >= C4_COLS || b[idx(rr, cc)] !== ch) break;
          line.push(idx(rr, cc));
        }
        if (line.length === 4) return { status: "win", winner: ch === "R" ? "first" : "second", line };
      }
    }
  }
  return b.includes(".") ? { status: "ongoing" } : { status: "draw" };
}

export const connectfour: Engine<C4State, C4Move> = {
  type: "connectfour",
  initialState: () => ({ board: ".".repeat(C4_COLS * C4_ROWS), last: null }),
  mover,
  status,
  legalMoves(state) {
    if (status(state).status !== "ongoing") return [];
    return Array.from({ length: C4_COLS }, (_, c) => c).filter((c) => landingRow(state.board, c) >= 0);
  },
  applyMove(state, col) {
    const r = landingRow(state.board, col);
    const b = state.board.split("");
    b[idx(r, col)] = mark(mover(state));
    return { board: b.join(""), last: idx(r, col) };
  },
};
