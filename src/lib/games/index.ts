/**
 * Engine access without dragging chess.js into every route: this module is
 * imported by the live-events layer (open-game listener), so it stays free of
 * engine code. The light engines are tiny; chess loads on first use.
 */
import { battleship } from "@/lib/games/battleship";
import { checkers } from "@/lib/games/checkers";
import { connectfour } from "@/lib/games/connectfour";
import { dots, dotsInitial } from "@/lib/games/dots";
import { hangman } from "@/lib/games/hangman";
import { tictactoe } from "@/lib/games/tictactoe";
import type { Engine, GameType } from "@/lib/games/types";

export * from "@/lib/games/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEngine = Engine<any, any>;

const LIGHT: Partial<Record<GameType, AnyEngine>> = { tictactoe, connectfour, checkers, dots, hangman, battleship };

/** The standard chess start, so a new game needs no engine at all. */
const CHESS_START = { fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", history: [], lastMove: null };

/** Lobby choices that shape the opening position (Dots and Boxes: dots per side). */
export interface GameOptions {
  size?: number;
}

export function initialStateFor(type: GameType, options: GameOptions = {}): unknown {
  if (type === "chess") return CHESS_START;
  if (type === "dots") return dotsInitial(options.size);
  return LIGHT[type]?.initialState();
}

/** The options a finished game was started with, so a rematch keeps them (read from stored state, so it's defensive). */
export function optionsOf(type: GameType, stateJson: string): GameOptions {
  if (type !== "dots") return {};
  try {
    const size = (JSON.parse(stateJson) as { size?: unknown }).size;
    return typeof size === "number" ? { size } : {};
  } catch {
    return {};
  }
}

/** Resolve an engine; chess.js arrives through a dynamic import the first time. */
export async function loadEngine(type: GameType): Promise<AnyEngine> {
  const light = LIGHT[type];
  if (light) return light;
  return (await import("@/lib/games/chess")).chess;
}
