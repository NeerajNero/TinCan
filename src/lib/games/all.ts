/** Every engine, synchronously — for the game screen only (it owns the chess chunk). */
import { battleship } from "@/lib/games/battleship";
import { checkers } from "@/lib/games/checkers";
import { chess } from "@/lib/games/chess";
import { connectfour } from "@/lib/games/connectfour";
import { dots } from "@/lib/games/dots";
import { hangman } from "@/lib/games/hangman";
import { tictactoe } from "@/lib/games/tictactoe";
import type { Engine, GameType } from "@/lib/games/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ENGINES: Record<GameType, Engine<any, any>> = { tictactoe, connectfour, checkers, chess, dots, hangman, battleship };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function engineFor(type: GameType): Engine<any, any> {
  return ENGINES[type];
}
