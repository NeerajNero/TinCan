import { NextResponse } from "next/server";
import { z } from "zod";

import { applyHangmanGuess, currentRound, hangmanMover, hangmanStatus, HANGMAN_LETTERS, hangmanWordError, type HangmanState } from "@/lib/games/hangman";
import { uidOf, type GameNode } from "@/lib/games/node";
import { afterServerMove, finishedFields, loadGame, loadPrivate, transactGame } from "@/lib/server/games";
import { errorResponse, guard, GuardError, readJson } from "@/lib/server/guard";

const bodySchema = z.object({ gameId: z.string().min(1).max(64), letter: z.string().regex(/^[a-z]$/) }).strict();

/**
 * POST /api/games/hangman/guess — the guesser tries one letter. The setter's
 * word is read from their owner-only subtree, the round's mask / misses are
 * updated in the shared node, and the word is revealed there when the round
 * ends. Replies `{ hit, roundOver, finished, winnerId }`.
 */
export async function POST(req: Request) {
  try {
    const caller = await guard(req, "games");
    const { gameId, letter } = await readJson(req, bodySchema);

    const game = await loadGame(gameId);
    if (game.type !== "hangman" || game.status !== "active") throw new GuardError(409, "not_playable");
    const state = JSON.parse(game.state) as HangmanState;
    const round = currentRound(state);
    if (state.phase !== "guessing" || uidOf(game, hangmanMover(state)) !== caller.uid) throw new GuardError(409, "not_your_turn");
    if (!HANGMAN_LETTERS.includes(letter) || round.guessed.includes(letter)) throw new GuardError(409, "already_guessed");

    const priv = await loadPrivate<{ word?: unknown; round?: unknown }>(gameId, uidOf(game, round.setter));
    const word = typeof priv?.word === "string" ? priv.word : null;
    if (!word || hangmanWordError(word) || priv?.round !== state.round) throw new GuardError(409, "no_word");

    let hit = false;
    let roundOver = false;
    const after = await transactGame(gameId, (current) => {
      if (current.status !== "active") return;
      const cur = JSON.parse(current.state) as HangmanState;
      if (cur.phase !== "guessing" || cur.round !== state.round || uidOf(current, hangmanMover(cur)) !== caller.uid || currentRound(cur).guessed.includes(letter)) return;
      const next = applyHangmanGuess(cur, letter, word);
      hit = word.includes(letter);
      roundOver = next.round !== cur.round || next.phase === "done";
      const st = hangmanStatus(next);
      const node: GameNode = { ...current, state: JSON.stringify(next), turn: hangmanMover(next), moves: (current.moves ?? 0) + 1, lastMoveAt: Date.now() };
      return st.status === "win" && st.winner ? { ...node, ...finishedFields(uidOf(current, st.winner)) } : node;
    });
    await afterServerMove(gameId, game, after, caller.uid, "🪢 Your turn in Hangman");
    return NextResponse.json({ hit, roundOver, finished: after.status === "finished", winnerId: after.winnerId });
  } catch (err) {
    return errorResponse(err, "games");
  }
}
