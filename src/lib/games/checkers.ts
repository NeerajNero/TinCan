import { type Engine, type GameStatus, type Player } from "@/lib/games/types";

/**
 * English draughts on an 8×8 board, 64 chars row-major with row 0 at the top.
 * 'r'/'R' = first (starts at the bottom, moves up), 'b'/'B' = second (starts
 * at the top, moves down). Captures are mandatory and chain; reaching the far
 * row crowns and ends the move.
 */
export interface CheckersState {
  board: string;
  turn: Player;
  /** Plies since the last capture or crowning (draw at 80). */
  quiet: number;
}
export interface CheckersMove {
  /** Squares visited, start first. Length 2 for a step, ≥2 for jumps. */
  path: number[];
  captures: number[];
}

const SIZE = 8;
const rc = (i: number) => [Math.floor(i / SIZE), i % SIZE] as const;
const at = (r: number, c: number) => r * SIZE + c;
const inside = (r: number, c: number) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

const ownerOf = (ch: string): Player | null => (ch === "r" || ch === "R" ? "first" : ch === "b" || ch === "B" ? "second" : null);
const isKing = (ch: string) => ch === "R" || ch === "B";

function dirsFor(ch: string): Array<[number, number]> {
  if (isKing(ch)) return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  return ch === "r" ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
}

function initialBoard(): string {
  const b: string[] = Array(64).fill(".");
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if ((r + c) % 2 !== 1) continue;
      if (r < 3) b[at(r, c)] = "b";
      if (r > 4) b[at(r, c)] = "r";
    }
  }
  return b.join("");
}

function jumpsFrom(board: string[], from: number, ch: string, taken: Set<number>): CheckersMove[] {
  const [r, c] = rc(from);
  const player = ownerOf(ch);
  const out: CheckersMove[] = [];
  for (const [dr, dc] of dirsFor(ch)) {
    const mr = r + dr;
    const mc = c + dc;
    const lr = r + dr * 2;
    const lc = c + dc * 2;
    if (!inside(lr, lc)) continue;
    const mid = at(mr, mc);
    const land = at(lr, lc);
    const midOwner = ownerOf(board[mid]);
    if (!midOwner || midOwner === player || taken.has(mid) || board[land] !== ".") continue;
    const crowned = !isKing(ch) && ((ch === "r" && lr === 0) || (ch === "b" && lr === SIZE - 1));
    const nextTaken = new Set(taken).add(mid);
    // Simulate: piece leaves `from`, lands on `land`; captured pieces stay until the move ends (so they can't be re-jumped — tracked by `taken`).
    const next = board.slice();
    next[from] = ".";
    next[land] = ch;
    const further = crowned ? [] : jumpsFrom(next, land, ch, nextTaken);
    if (further.length === 0) out.push({ path: [from, land], captures: [mid] });
    else for (const f of further) out.push({ path: [from, ...f.path.slice(0)], captures: [mid, ...f.captures] });
  }
  return out;
}

function movesFor(state: CheckersState): CheckersMove[] {
  const board = state.board.split("");
  const steps: CheckersMove[] = [];
  const jumps: CheckersMove[] = [];
  for (let i = 0; i < 64; i++) {
    const ch = board[i];
    if (ownerOf(ch) !== state.turn) continue;
    const [r, c] = rc(i);
    jumps.push(...jumpsFrom(board, i, ch, new Set()));
    for (const [dr, dc] of dirsFor(ch)) {
      const nr = r + dr;
      const nc = c + dc;
      if (inside(nr, nc) && board[at(nr, nc)] === ".") steps.push({ path: [i, at(nr, nc)], captures: [] });
    }
  }
  return jumps.length ? jumps : steps;
}

function status(state: CheckersState): GameStatus {
  const hasFirst = /[rR]/.test(state.board);
  const hasSecond = /[bB]/.test(state.board);
  if (!hasFirst) return { status: "win", winner: "second" };
  if (!hasSecond) return { status: "win", winner: "first" };
  if (state.quiet >= 80) return { status: "draw" };
  if (movesFor(state).length === 0) return { status: "win", winner: state.turn === "first" ? "second" : "first" };
  return { status: "ongoing" };
}

export const checkers: Engine<CheckersState, CheckersMove> = {
  type: "checkers",
  initialState: () => ({ board: initialBoard(), turn: "first", quiet: 0 }),
  mover: (s) => s.turn,
  status,
  legalMoves(state) {
    return status(state).status === "ongoing" ? movesFor(state) : [];
  },
  applyMove(state, move) {
    const b = state.board.split("");
    const from = move.path[0];
    const to = move.path[move.path.length - 1];
    let ch = b[from];
    b[from] = ".";
    for (const cap of move.captures) b[cap] = ".";
    const [tr] = rc(to);
    let crowned = false;
    if (ch === "r" && tr === 0) {
      ch = "R";
      crowned = true;
    }
    if (ch === "b" && tr === SIZE - 1) {
      ch = "B";
      crowned = true;
    }
    b[to] = ch;
    return { board: b.join(""), turn: state.turn === "first" ? "second" : "first", quiet: move.captures.length || crowned ? 0 : state.quiet + 1 };
  },
};

export const checkersHelpers = { ownerOf, isKing, rc, at };
