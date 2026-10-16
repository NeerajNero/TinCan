import { type Engine, type GameStatus, type Player } from "@/lib/games/types";

/** board: 9 chars of '.', 'X' (first) or 'O' (second), row-major. */
export interface TttState {
  board: string;
}
export type TttMove = number;

const LINES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const mark = (p: Player) => (p === "first" ? "X" : "O");

function mover(state: TttState): Player {
  const filled = state.board.replace(/\./g, "").length;
  return filled % 2 === 0 ? "first" : "second";
}

function status(state: TttState): GameStatus {
  for (const line of LINES) {
    const [a, b, c] = line;
    const ch = state.board[a];
    if (ch && ch !== "." && ch === state.board[b] && ch === state.board[c]) return { status: "win", winner: ch === "X" ? "first" : "second", line: [...line] };
  }
  return state.board.includes(".") ? { status: "ongoing" } : { status: "draw" };
}

export const tictactoe: Engine<TttState, TttMove> = {
  type: "tictactoe",
  initialState: () => ({ board: "........." }),
  mover,
  status,
  legalMoves(state) {
    if (status(state).status !== "ongoing") return [];
    return Array.from(state.board).flatMap((ch, i) => (ch === "." ? [i] : []));
  },
  applyMove(state, move) {
    const b = state.board.split("");
    b[move] = mark(mover(state));
    return { board: b.join("") };
  },
};
