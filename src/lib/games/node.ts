/**
 * The RTDB `games/{id}` node and the wording built from it. Pure: shared by
 * the client (`lib/db/games.ts`) and the server routes that resolve Hangman
 * guesses and Battleship shots.
 */
import { gameInfo } from "@/lib/games/catalog";
import type { GameType, Player } from "@/lib/games/types";

type GameStatusKey = "invited" | "active" | "finished" | "declined";
export type EndReason = "win" | "draw" | "resign" | "abandoned" | "cancelled";

export interface GameNode {
  type: GameType;
  /** JSON of the engine state. */
  state: string;
  turn: Player;
  players: { first: string; second: string };
  status: GameStatusKey;
  /** True while not finished/declined; indexed for the landing query. */
  open: boolean;
  createdBy: string;
  createdAt: number;
  lastMoveAt: number;
  moves: number;
  winnerId: string | null;
  endReason: EndReason | null;
  rematchOf?: string;
  /** Set when finished; the game stays listed (open) for a few hours, then the tick closes it. */
  finishedAt?: number;
}

export interface LiveGame extends GameNode {
  id: string;
}

export const uidOf = (g: GameNode, p: Player) => (p === "first" ? g.players.first : g.players.second);
export const playerOf = (g: GameNode, uid: string): Player | null => (g.players.first === uid ? "first" : g.players.second === uid ? "second" : null);
export const opponentOf = (g: GameNode, uid: string): string => (g.players.first === uid ? g.players.second : g.players.first);

/** "Priya resigned at Chess — you win 🎉" / "Checkmate — Priya wins at Chess" / "Draw at Chess". */
export function resultForRecipient(game: GameNode, recipient: string, nameOf: (uid: string) => string): string {
  const meta = gameInfo(game.type);
  const otherUid = opponentOf(game, recipient);
  if (!game.winnerId) return `${meta.emoji} Draw at ${meta.name}`;
  const won = game.winnerId === recipient;
  if (game.endReason === "resign") return won ? `${meta.emoji} ${nameOf(otherUid)} resigned at ${meta.name} — you win 🎉` : `${meta.emoji} You resigned at ${meta.name}`;
  return won ? `${meta.emoji} You won at ${meta.name} 🎉` : `${meta.emoji} ${nameOf(otherUid)} won at ${meta.name}`;
}

/** Nickname-aware line, posted to chat when a board game ends. */
export function describeResult(game: GameNode, nameOf: (uid: string) => string): string {
  const meta = gameInfo(game.type);
  if (game.endReason === "cancelled") return `✕ The ${meta.name} game was cancelled`;
  if (!game.winnerId) return `${meta.emoji} ${nameOf(game.players.first)} and ${nameOf(game.players.second)} drew at ${meta.name}`;
  const loser = game.winnerId === game.players.first ? game.players.second : game.players.first;
  if (game.endReason === "resign") return `${meta.emoji} ${nameOf(loser)} conceded at ${meta.name} — ${nameOf(game.winnerId)} takes it`;
  return `${meta.emoji} ${nameOf(game.winnerId)} beat ${nameOf(loser)} at ${meta.name}`;
}
