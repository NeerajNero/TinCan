/**
 * Every game and activity that writes to `gameResults` (and so can appear in
 * Recent games, the record strip, invites and result messages). The single
 * source for names, emoji and routes. Stored rows are data from the past, so
 * lookups always go through `gameInfo()`, which falls back safely for a type
 * this build doesn't know (an old or future game, a hand-edited row).
 */
import type { GameType } from "@/lib/games/types";

export type ResultGame = GameType | "trivia" | "pictionary" | "word";

export interface GameInfo {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  /** Where "play again" goes. */
  route: string;
  /** Used in result lines: "won the {resultLabel}". */
  resultLabel: string;
}

export const GAME_CATALOG: Record<ResultGame, GameInfo> = {
  tictactoe: { id: "tictactoe", name: "Tic-tac-toe", emoji: "❌", blurb: "Three in a row", route: "/play", resultLabel: "Tic-tac-toe game" },
  connectfour: { id: "connectfour", name: "Connect Four", emoji: "🔴", blurb: "Drop and connect", route: "/play", resultLabel: "Connect Four game" },
  chess: { id: "chess", name: "Chess", emoji: "♟️", blurb: "The long game", route: "/play", resultLabel: "chess game" },
  checkers: { id: "checkers", name: "Checkers", emoji: "⚪", blurb: "Jump and crown", route: "/play", resultLabel: "checkers game" },
  trivia: { id: "trivia", name: "Trivia duel", emoji: "🧠", blurb: "Ten questions, 15 s each", route: "/play/trivia", resultLabel: "trivia duel" },
  pictionary: { id: "pictionary", name: "Pictionary", emoji: "🎨", blurb: "Three rounds, 60 s", route: "/play/pictionary", resultLabel: "Pictionary game" },
  word: { id: "word", name: "Daily word", emoji: "🟩", blurb: "Fewer guesses wins the day", route: "/play/word", resultLabel: "daily word" },
};

export const UNKNOWN_GAME: GameInfo = { id: "unknown", name: "A game", emoji: "🎲", blurb: "", route: "/play", resultLabel: "game" };

/** Board games, in the order the Play tab lists them. */
export const BOARD_GAMES: readonly GameType[] = ["tictactoe", "connectfour", "chess", "checkers"];

/** Games with a head-to-head record on pair/main.records. */
export const RECORD_GAMES: readonly ResultGame[] = [...BOARD_GAMES, "trivia", "pictionary", "word"];

const isKnown = (id: string): id is ResultGame => Object.hasOwn(GAME_CATALOG, id);

/** Safe lookup for anything read from storage: never undefined. */
export function gameInfo(id: string | null | undefined): GameInfo {
  return id && isKnown(id) ? GAME_CATALOG[id] : UNKNOWN_GAME;
}

/** The chat line posted when a non-board game ends. */
export function resultLine(game: string, winnerName: string | null): string {
  const g = gameInfo(game);
  return winnerName ? `${g.emoji} ${winnerName} won the ${g.resultLabel}` : `${g.emoji} The ${g.resultLabel} was a tie`;
}
