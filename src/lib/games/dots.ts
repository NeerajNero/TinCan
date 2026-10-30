import { other, type Engine, type GameStatus, type Player } from "@/lib/games/types";

/**
 * Dots and Boxes. `size` is dots per side (5 → 4×4 boxes, 6 → 5×5). Edges are
 * two strings of '.' / '#': `h` has `size` rows of `size-1` horizontal edges
 * (index r*(size-1)+c joins dot (r,c) to (r,c+1)); `v` has `size-1` rows of
 * `size` vertical edges (index r*size+c joins dot (r,c) to (r+1,c)). `boxes`
 * is '.', 'A' (first) or 'B' (second), row-major over (size-1)². Completing a
 * box keeps the turn, so `turn` is stored rather than derived.
 */
export const DOTS_SIZES = [5, 6] as const;
type DotsSize = (typeof DOTS_SIZES)[number];
const DOTS_DEFAULT_SIZE: DotsSize = 5;

export interface DotsState {
  size: number;
  h: string;
  v: string;
  boxes: string;
  turn: Player;
  last: DotsMove | null;
}
export interface DotsMove {
  kind: "h" | "v";
  i: number;
}

export const dotsInitial = (size: number = DOTS_DEFAULT_SIZE): DotsState => {
  const n = DOTS_SIZES.includes(size as DotsSize) ? size : DOTS_DEFAULT_SIZE;
  const b = n - 1;
  return { size: n, h: ".".repeat(n * b), v: ".".repeat(b * n), boxes: ".".repeat(b * b), turn: "first", last: null };
};

const mark = (p: Player) => (p === "first" ? "A" : "B");

/** The four edges of box (r, c). */
function edgesOfBox(size: number, r: number, c: number) {
  const b = size - 1;
  return { top: r * b + c, bottom: (r + 1) * b + c, left: r * size + c, right: r * size + c + 1 };
}

const boxClosed = (state: DotsState, r: number, c: number): boolean => {
  const e = edgesOfBox(state.size, r, c);
  return state.h[e.top] === "#" && state.h[e.bottom] === "#" && state.v[e.left] === "#" && state.v[e.right] === "#";
};

/** Boxes touching an edge: one or two (r, c) pairs. */
function boxesByEdge(size: number, move: DotsMove): Array<[number, number]> {
  const b = size - 1;
  if (move.kind === "h") {
    const r = Math.floor(move.i / b);
    const c = move.i % b;
    const out: Array<[number, number]> = [];
    if (r > 0) out.push([r - 1, c]);
    if (r < b) out.push([r, c]);
    return out;
  }
  const r = Math.floor(move.i / size);
  const c = move.i % size;
  const out: Array<[number, number]> = [];
  if (c > 0) out.push([r, c - 1]);
  if (c < b) out.push([r, c]);
  return out;
}

export function dotsScores(state: DotsState): { first: number; second: number } {
  let first = 0;
  let second = 0;
  for (const ch of state.boxes) {
    if (ch === "A") first++;
    else if (ch === "B") second++;
  }
  return { first, second };
}

function status(state: DotsState): GameStatus {
  if (state.boxes.includes(".")) return { status: "ongoing" };
  const { first, second } = dotsScores(state);
  if (first === second) return { status: "draw" };
  return { status: "win", winner: first > second ? "first" : "second" };
}

export const dots: Engine<DotsState, DotsMove> = {
  type: "dots",
  initialState: () => dotsInitial(),
  mover: (state) => state.turn,
  status,
  legalMoves(state) {
    if (status(state).status !== "ongoing") return [];
    const out: DotsMove[] = [];
    for (let i = 0; i < state.h.length; i++) if (state.h[i] === ".") out.push({ kind: "h", i });
    for (let i = 0; i < state.v.length; i++) if (state.v[i] === ".") out.push({ kind: "v", i });
    return out;
  },
  applyMove(state, move) {
    const edges = (move.kind === "h" ? state.h : state.v).split("");
    edges[move.i] = "#";
    const next: DotsState = { ...state, [move.kind]: edges.join(""), last: move };
    const b = state.size - 1;
    const boxes = next.boxes.split("");
    let claimed = 0;
    for (const [r, c] of boxesByEdge(state.size, move)) {
      if (boxes[r * b + c] === "." && boxClosed(next, r, c)) {
        boxes[r * b + c] = mark(state.turn);
        claimed++;
      }
    }
    return { ...next, boxes: boxes.join(""), turn: claimed > 0 ? state.turn : other(state.turn) };
  },
};
