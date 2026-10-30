import { other, type Engine, type GameStatus, type Player } from "@/lib/games/types";

/**
 * Battleship on a 10×10 grid with five ships (5, 4, 3, 3, 2). A player's
 * fleet lives at RTDB `gamePrivate/{gameId}/{uid}.fleet` (owner-only; JSON of
 * `Ship[]`). This shared state only ever holds what both may see: readiness,
 * the shots each player fired (`shots.first` = first's shots at second's
 * fleet), the ships of each fleet that are sunk (all their cells are hits by
 * then) and the last shot. `POST /api/games/battleship/shot` resolves a shot
 * against the opponent's private fleet with the admin SDK.
 */
export const BS_SIZE = 10;
export const BS_SHIPS: readonly number[] = [5, 4, 3, 3, 2];
export const BS_CELLS = BS_SIZE * BS_SIZE;

export interface Ship {
  r: number;
  c: number;
  len: number;
  dir: "h" | "v";
}
export type ShotResult = "hit" | "miss" | "sunk";
type CellShot = "hit" | "miss";
interface SunkShip {
  len: number;
  cells: number[];
}
export interface BattleshipState {
  phase: "placing" | "firing" | "done";
  ready: { first: boolean; second: boolean };
  /** Shots fired BY that player, keyed by cell index (r*10+c) as a string. */
  shots: { first: Record<string, CellShot>; second: Record<string, CellShot> };
  /** Ships OF that player that are sunk. */
  sunk: { first: SunkShip[]; second: SunkShip[] };
  last: { by: Player; cell: number; result: ShotResult; len?: number } | null;
  turn: Player;
}

export const battleshipInitial = (): BattleshipState => ({ phase: "placing", ready: { first: false, second: false }, shots: { first: {}, second: {} }, sunk: { first: [], second: [] }, last: null, turn: "first" });

export const cellIndex = (r: number, c: number) => r * BS_SIZE + c;

export function cellsOf(ship: Ship): number[] {
  return Array.from({ length: ship.len }, (_, k) => (ship.dir === "h" ? cellIndex(ship.r, ship.c + k) : cellIndex(ship.r + k, ship.c)));
}

const inBounds = (ship: Ship) => ship.r >= 0 && ship.c >= 0 && (ship.dir === "h" ? ship.c + ship.len <= BS_SIZE && ship.r < BS_SIZE : ship.r + ship.len <= BS_SIZE && ship.c < BS_SIZE);

/** No overlaps, all in bounds (lengths are not checked here, so a partial placement can be validated). */
export function shipsFit(ships: readonly Ship[]): boolean {
  const seen = new Set<number>();
  for (const s of ships) {
    if (!Number.isInteger(s.r) || !Number.isInteger(s.c) || !Number.isInteger(s.len) || !inBounds(s)) return false;
    for (const cell of cellsOf(s)) {
      if (seen.has(cell)) return false;
      seen.add(cell);
    }
  }
  return true;
}

/** A complete, legal fleet: exactly the five lengths, in bounds, no overlaps. */
export function fleetValid(ships: readonly Ship[]): boolean {
  const lens = ships.map((s) => s.len).sort((a, b) => b - a);
  return lens.length === BS_SHIPS.length && lens.every((l, i) => l === BS_SHIPS[i]) && shipsFit(ships);
}

/** A random legal fleet; `rand` in [0, 1) so tests can pin it. */
export function randomFleet(rand: () => number = Math.random): Ship[] {
  const ships: Ship[] = [];
  for (const len of BS_SHIPS) {
    for (let tries = 0; tries < 500; tries++) {
      const dir: Ship["dir"] = rand() < 0.5 ? "h" : "v";
      const r = Math.floor(rand() * (dir === "v" ? BS_SIZE - len + 1 : BS_SIZE));
      const c = Math.floor(rand() * (dir === "h" ? BS_SIZE - len + 1 : BS_SIZE));
      const ship = { r, c, len, dir };
      if (shipsFit([...ships, ship])) {
        ships.push(ship);
        break;
      }
    }
  }
  return ships.length === BS_SHIPS.length ? ships : randomFleet(rand);
}

function shipAt(fleet: readonly Ship[], cell: number): Ship | null {
  return fleet.find((s) => cellsOf(s).includes(cell)) ?? null;
}

/** What a shot at `cell` does to `fleet`, given the shots already on it. */
export function resolveShot(fleet: readonly Ship[], shots: Record<string, CellShot>, cell: number): { result: ShotResult; ship: Ship | null } {
  const ship = shipAt(fleet, cell);
  if (!ship) return { result: "miss", ship: null };
  const sunk = cellsOf(ship).every((k) => k === cell || shots[String(k)] === "hit");
  return { result: sunk ? "sunk" : "hit", ship };
}

export const allSunk = (fleet: readonly Ship[], shots: Record<string, CellShot>): boolean => fleet.every((s) => cellsOf(s).every((k) => shots[String(k)] === "hit"));

/** A player's fleet is placed. Both in → firing, the inviter shoots first; else it's the other's move. */
export function markReady(state: BattleshipState, p: Player): BattleshipState {
  if (state.phase !== "placing" || state.ready[p]) return state;
  const ready = { ...state.ready, [p]: true };
  const both = ready.first && ready.second;
  return { ...state, ready, phase: both ? "firing" : "placing", turn: both ? "first" : other(p) };
}

/** `by` fires at `cell` on the other player's `targetFleet`. Returns the state unchanged when the shot is not allowed. */
export function applyShot(state: BattleshipState, by: Player, cell: number, targetFleet: readonly Ship[]): { state: BattleshipState; result: ShotResult | null } {
  if (state.phase !== "firing" || state.turn !== by || !Number.isInteger(cell) || cell < 0 || cell >= BS_CELLS || state.shots[by][String(cell)]) return { state, result: null };
  const { result, ship } = resolveShot(targetFleet, state.shots[by], cell);
  const shots = { ...state.shots, [by]: { ...state.shots[by], [String(cell)]: result === "miss" ? "miss" : "hit" } } as BattleshipState["shots"];
  const target = other(by);
  const sunk = result === "sunk" && ship ? { ...state.sunk, [target]: [...state.sunk[target], { len: ship.len, cells: cellsOf(ship) }] } : state.sunk;
  const done = allSunk(targetFleet, shots[by]);
  return {
    state: { ...state, shots, sunk, last: { by, cell, result, ...(ship ? { len: ship.len } : {}) }, phase: done ? "done" : "firing", turn: done ? by : target },
    result,
  };
}

/** During placement everyone who hasn't readied is "on"; afterwards it's whoever's turn. */
export function battleshipMyMove(state: BattleshipState, p: Player): boolean {
  if (state.phase === "placing") return !state.ready[p];
  return state.phase === "firing" && state.turn === p;
}

export function battleshipStatus(state: BattleshipState): GameStatus {
  if (state.phase !== "done") return { status: "ongoing" };
  return { status: "win", winner: state.turn };
}

export function shipName(len: number): string {
  return len === 5 ? "carrier" : len === 4 ? "battleship" : len === 3 ? "cruiser" : "patrol boat";
}

/** Engine shape for the shared game plumbing; shots go through the API, placement through `readyBattleship`. */
export const battleship: Engine<BattleshipState, number> = {
  type: "battleship",
  initialState: battleshipInitial,
  mover: (state) => state.turn,
  status: battleshipStatus,
  legalMoves: () => [],
  applyMove() {
    throw new Error("battleship shots are resolved by the server");
  },
};
