/**
 * Engine access without dragging chess.js into every route: this module is
 * imported by the live-events layer (open-game listener), so it stays free of
 * engine code. The light engines are tiny; chess loads on first use.
 */
import { checkers } from "@/lib/games/checkers";
import { connectfour } from "@/lib/games/connectfour";
import { tictactoe } from "@/lib/games/tictactoe";
import type { Engine, GameType } from "@/lib/games/types";

export * from "@/lib/games/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEngine = Engine<any, any>;

const LIGHT: Partial<Record<GameType, AnyEngine>> = { tictactoe, connectfour, checkers };

/** The standard chess start, so a new game needs no engine at all. */
const CHESS_START = { fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", history: [], lastMove: null };

export function initialStateFor(type: GameType): unknown {
  return type === "chess" ? CHESS_START : LIGHT[type]?.initialState();
}

/** Resolve an engine; chess.js arrives through a dynamic import the first time. */
export async function loadEngine(type: GameType): Promise<AnyEngine> {
  const light = LIGHT[type];
  if (light) return light;
  return (await import("@/lib/games/chess")).chess;
}
