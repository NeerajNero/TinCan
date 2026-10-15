/** Shared shape for every turn-based game. State must survive JSON round-trips. */
export type Player = "first" | "second";
export type GameType = "tictactoe" | "connectfour" | "checkers" | "chess";

export interface GameStatus {
  status: "ongoing" | "win" | "draw";
  winner?: Player;
  /** Board indices to highlight on a win, when the game has them. */
  line?: number[];
}

export interface Engine<S, M> {
  type: GameType;
  initialState(): S;
  /** Legal moves for the player to move (empty when the game is over). */
  legalMoves(state: S): M[];
  /** Must be called with a legal move. */
  applyMove(state: S, move: M): S;
  status(state: S): GameStatus;
  /** Whose turn it is in this state. */
  mover(state: S): Player;
}

export const GAME_META: Record<GameType, { name: string; emoji: string; blurb: string }> = {
  tictactoe: { name: "Tic-tac-toe", emoji: "❌", blurb: "Three in a row" },
  connectfour: { name: "Connect Four", emoji: "🔴", blurb: "Drop and connect" },
  chess: { name: "Chess", emoji: "♟️", blurb: "The long game" },
  checkers: { name: "Checkers", emoji: "⚪", blurb: "Jump and crown" },
};

export const GAME_TYPES: readonly GameType[] = ["tictactoe", "connectfour", "chess", "checkers"];

export const other = (p: Player): Player => (p === "first" ? "second" : "first");
