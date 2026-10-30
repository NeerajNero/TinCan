import { NextResponse } from "next/server";
import { z } from "zod";

import { applyShot, BS_CELLS, battleshipStatus, fleetValid, type BattleshipState, type Ship, type ShotResult } from "@/lib/games/battleship";
import { opponentOf, playerOf, uidOf, type GameNode } from "@/lib/games/node";
import { afterServerMove, finishedFields, loadGame, loadPrivate, transactGame } from "@/lib/server/games";
import { errorResponse, guard, GuardError, readJson } from "@/lib/server/guard";

const bodySchema = z.object({ gameId: z.string().min(1).max(64), cell: z.number().int().min(0).max(BS_CELLS - 1) }).strict();

function parseFleet(raw: unknown): Ship[] | null {
  if (typeof raw !== "string") return null;
  try {
    const fleet = JSON.parse(raw) as Ship[];
    return Array.isArray(fleet) && fleetValid(fleet) ? fleet : null;
  } catch {
    return null;
  }
}

/**
 * POST /api/games/battleship/shot — the player to move fires at one cell.
 * The opponent's fleet is read from their owner-only subtree; hit / miss /
 * sunk (with the sunk ship's cells) and the turn go to the shared node, and
 * the game is marked won when every ship is down. Replies `{ result, finished, winnerId }`.
 */
export async function POST(req: Request) {
  try {
    const caller = await guard(req, "games");
    const { gameId, cell } = await readJson(req, bodySchema);

    const game = await loadGame(gameId);
    if (game.type !== "battleship" || game.status !== "active") throw new GuardError(409, "not_playable");
    const me = playerOf(game, caller.uid);
    const state = JSON.parse(game.state) as BattleshipState;
    if (!me || state.phase !== "firing" || state.turn !== me) throw new GuardError(409, "not_your_turn");
    if (state.shots[me][String(cell)]) throw new GuardError(409, "already_shot");

    const fleet = parseFleet((await loadPrivate<{ fleet?: unknown }>(gameId, opponentOf(game, caller.uid)))?.fleet);
    if (!fleet) throw new GuardError(409, "no_fleet");

    let result: ShotResult | null = null;
    const after = await transactGame(gameId, (current) => {
      if (current.status !== "active") return;
      const cur = JSON.parse(current.state) as BattleshipState;
      const shot = applyShot(cur, me, cell, fleet);
      if (!shot.result) return;
      result = shot.result;
      const st = battleshipStatus(shot.state);
      const node: GameNode = { ...current, state: JSON.stringify(shot.state), turn: shot.state.turn, moves: (current.moves ?? 0) + 1, lastMoveAt: Date.now() };
      return st.status === "win" && st.winner ? { ...node, ...finishedFields(uidOf(current, st.winner)) } : node;
    });
    await afterServerMove(gameId, game, after, caller.uid, `🚢 ${result === "miss" ? "They missed" : result === "sunk" ? "They sank one of yours" : "They hit you"} — your shot in Battleship`);
    return NextResponse.json({ result, finished: after.status === "finished", winnerId: after.winnerId });
  } catch (err) {
    return errorResponse(err, "games");
  }
}
