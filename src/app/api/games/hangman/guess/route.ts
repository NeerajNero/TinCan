import { after, NextResponse } from "next/server";
import { z } from "zod";

import { applyHangmanGuess, currentRound, hangmanMover, hangmanStatus, HANGMAN_LETTERS, hangmanWordError, type HangmanState } from "@/lib/games/hangman";
import { uidOf, type GameNode } from "@/lib/games/node";
import { afterServerMove, finishedFields, openGame } from "@/lib/server/games";
import { errorResponse, guardFast, GuardError, readJson } from "@/lib/server/guard";

const bodySchema = z.object({ gameId: z.string().min(1).max(64), letter: z.string().regex(/^[a-z]$/) }).strict();

/**
 * POST /api/games/hangman/guess — the guesser tries one letter. The setter's
 * word is read from their owner-only subtree, the round's mask / misses are
 * updated in the shared node, and the word is revealed there when the round
 * ends. Replies `{ hit, roundOver, finished, winnerId }`.
 */
export async function POST(req: Request) {
  try {
    const caller = await guardFast(req, "games");
    const { gameId, letter } = await readJson(req, bodySchema);

    const open = await openGame(gameId);
    const game = open.game;
    let state: HangmanState;
    let word: string;
    try {
      if (game.type !== "hangman" || game.status !== "active") throw new GuardError(409, "not_playable");
      state = JSON.parse(game.state) as HangmanState;
      const round = currentRound(state);
      if (state.phase !== "guessing" || uidOf(game, hangmanMover(state)) !== caller.uid) throw new GuardError(409, "not_your_turn");
      if (!HANGMAN_LETTERS.includes(letter) || round.guessed.includes(letter)) throw new GuardError(409, "already_guessed");
      const priv = open.privates[uidOf(game, round.setter)] as { word?: unknown; round?: unknown } | undefined;
      const w = typeof priv?.word === "string" ? priv.word : null;
      if (!w || hangmanWordError(w) || priv?.round !== state.round) throw new GuardError(409, "no_word");
      word = w;
    } catch (e) {
      open.close();
      throw e;
    }
    const setRound = state.round;
    const theWord = word;

    let hit = false;
    let roundOver = false;
    const next = await open.commit((current) => {
      if (current.status !== "active") return;
      const cur = JSON.parse(current.state) as HangmanState;
      if (cur.phase !== "guessing" || cur.round !== setRound || uidOf(current, hangmanMover(cur)) !== caller.uid || currentRound(cur).guessed.includes(letter)) return;
      const after = applyHangmanGuess(cur, letter, theWord);
      hit = theWord.includes(letter);
      roundOver = after.round !== cur.round || after.phase === "done";
      const st = hangmanStatus(after);
      const node: GameNode = { ...current, state: JSON.stringify(after), turn: hangmanMover(after), moves: (current.moves ?? 0) + 1, lastMoveAt: Date.now() };
      return st.status === "win" && st.winner ? { ...node, ...finishedFields(uidOf(current, st.winner)) } : node;
    });
    after(() => afterServerMove(gameId, game, next, caller.uid, "🪢 Your turn in Hangman").catch((e: unknown) => console.error("[api/games] after guess", e)));
    return NextResponse.json({ hit, roundOver, finished: next.status === "finished", winnerId: next.winnerId });
  } catch (err) {
    return errorResponse(err, "games");
  }
}
