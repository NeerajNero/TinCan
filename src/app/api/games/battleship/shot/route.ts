import { after, NextResponse } from "next/server";
import { z } from "zod";

import { applyShot, BS_CELLS, battleshipStatus, fleetValid, type BattleshipState, type Ship, type ShotResult } from "@/lib/games/battleship";
import { opponentOf, playerOf, uidOf, type GameNode } from "@/lib/games/node";
import { afterServerMove, finishedFields, openGame } from "@/lib/server/games";
import { errorResponse, guardFast, GuardError, readJson } from "@/lib/server/guard";

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
 * Latency path: `guardFast` (no network), one round trip for the node + the
 * private subtrees, one for the transaction, then the response; the push and
 * the result bookkeeping run in `after()`.
 */
export async function POST(req: Request) {
  try {
    const caller = await guardFast(req, "games");
    const { gameId, cell } = await readJson(req, bodySchema);

    const open = await openGame(gameId);
    const game = open.game;
    let me: ReturnType<typeof playerOf>;
    let fleet: Ship[] | null;
    try {
      if (game.type !== "battleship" || game.status !== "active") throw new GuardError(409, "not_playable");
      me = playerOf(game, caller.uid);
      const state = JSON.parse(game.state) as BattleshipState;
      if (!me || state.phase !== "firing" || state.turn !== me) throw new GuardError(409, "not_your_turn");
      if (state.shots[me][String(cell)]) throw new GuardError(409, "already_shot");
      fleet = parseFleet((open.privates[opponentOf(game, caller.uid)] as { fleet?: unknown } | undefined)?.fleet);
      if (!fleet) throw new GuardError(409, "no_fleet");
    } catch (e) {
      open.close();
      throw e;
    }
    const mine = me;
    const theirs = fleet;

    let result: ShotResult | null = null;
    const next = await open.commit((current) => {
      if (current.status !== "active") return;
      const cur = JSON.parse(current.state) as BattleshipState;
      const shot = applyShot(cur, mine, cell, theirs);
      if (!shot.result) return;
      result = shot.result;
      const st = battleshipStatus(shot.state);
      const node: GameNode = { ...current, state: JSON.stringify(shot.state), turn: shot.state.turn, moves: (current.moves ?? 0) + 1, lastMoveAt: Date.now() };
      return st.status === "win" && st.winner ? { ...node, ...finishedFields(uidOf(current, st.winner)) } : node;
    });
    const body = `🚢 ${result === "miss" ? "They missed" : result === "sunk" ? "They sank one of yours" : "They hit you"} — your shot in Battleship`;
    after(() => afterServerMove(gameId, game, next, caller.uid, body).catch((e: unknown) => console.error("[api/games] after shot", e)));
    return NextResponse.json({ result, finished: next.status === "finished", winnerId: next.winnerId });
  } catch (err) {
    return errorResponse(err, "games");
  }
}
