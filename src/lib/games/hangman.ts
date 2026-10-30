import { other, type Engine, type GameStatus, type Player } from "@/lib/games/types";

/**
 * Hangman, best of three rounds. The setter's word never enters this state:
 * it lives at RTDB `gamePrivate/{gameId}/{setterUid}.word` (owner-only) and
 * `POST /api/games/hangman/guess` resolves each letter with it, writing the
 * mask back here. A round's `word` appears only once that round is over.
 * Roles alternate: the inviter sets round 1, the friend round 2, the
 * inviter round 3 (played only at 1–1).
 */
export const HANGMAN_MAX_WRONG = 6;
export const HANGMAN_ROUNDS = 3;
const HANGMAN_WIN_POINTS = 2;
export const HANGMAN_MAX_LEN = 20;
export const HANGMAN_LETTERS = "abcdefghijklmnopqrstuvwxyz";

export interface HangmanRound {
  setter: Player;
  /** Letters revealed so far, '_' for hidden letters, ' ' kept; "" until the word is set. */
  mask: string;
  /** Letters tried, in order. */
  guessed: string;
  wrong: number;
  /** From the guesser's side. */
  result?: "won" | "lost";
  /** Revealed when the round ends. */
  word?: string;
}

export interface HangmanState {
  phase: "setting" | "guessing" | "done";
  /** 0-based index into `rounds`. */
  round: number;
  rounds: HangmanRound[];
  scores: { first: number; second: number };
}

export const hangmanSetterFor = (roundIndex: number): Player => (roundIndex % 2 === 0 ? "first" : "second");

const newRound = (index: number): HangmanRound => ({ setter: hangmanSetterFor(index), mask: "", guessed: "", wrong: 0 });

export const hangmanInitial = (): HangmanState => ({ phase: "setting", round: 0, rounds: [newRound(0)], scores: { first: 0, second: 0 } });

export const currentRound = (state: HangmanState): HangmanRound => state.rounds[state.round] ?? newRound(state.round);

/** Lower-case, single spaces, trimmed. */
export const normalizeHangmanWord = (input: string): string => input.toLowerCase().replace(/\s+/g, " ").trim();

/** null when the word is playable, else a short reason. */
export function hangmanWordError(word: string): string | null {
  if (!word) return "Type a word or a short phrase";
  if (word.length > HANGMAN_MAX_LEN) return `Up to ${HANGMAN_MAX_LEN} characters, please`;
  if (!/^[a-z]([a-z ]*[a-z])?$/.test(word)) return "Letters and spaces only";
  return null;
}

/** '_' for every letter not yet guessed; spaces stay spaces. */
export function maskWord(word: string, guessed: string): string {
  return Array.from(word, (ch) => (ch === " " ? " " : guessed.includes(ch) ? ch : "_")).join("");
}

/** The setter has chosen: the round shows its shape and the guesser is on. */
export function startHangmanRound(state: HangmanState, word: string): HangmanState {
  if (state.phase !== "setting") return state;
  const rounds = state.rounds.slice();
  rounds[state.round] = { ...currentRound(state), mask: maskWord(word, ""), guessed: "", wrong: 0 };
  return { ...state, phase: "guessing", rounds };
}

/** One letter against the private word. Ends the round, and maybe the match. */
export function applyHangmanGuess(state: HangmanState, letter: string, word: string): HangmanState {
  const round = currentRound(state);
  if (state.phase !== "guessing" || !HANGMAN_LETTERS.includes(letter) || round.guessed.includes(letter)) return state;
  const guessed = round.guessed + letter;
  const hit = word.includes(letter);
  const wrong = round.wrong + (hit ? 0 : 1);
  const mask = maskWord(word, guessed);
  const result: HangmanRound["result"] | undefined = !mask.includes("_") ? "won" : wrong >= HANGMAN_MAX_WRONG ? "lost" : undefined;
  const rounds = state.rounds.slice();
  rounds[state.round] = { ...round, guessed, wrong, mask, ...(result ? { result, word } : {}) };
  if (!result) return { ...state, rounds };
  const guesser = other(round.setter);
  const pointTo = result === "won" ? guesser : round.setter;
  const scores = { ...state.scores, [pointTo]: state.scores[pointTo] + 1 };
  const finished = scores.first >= HANGMAN_WIN_POINTS || scores.second >= HANGMAN_WIN_POINTS || state.round + 1 >= HANGMAN_ROUNDS;
  if (finished) return { ...state, phase: "done", rounds, scores };
  return { phase: "setting", round: state.round + 1, rounds: [...rounds, newRound(state.round + 1)], scores };
}

export function hangmanMover(state: HangmanState): Player {
  const setter = currentRound(state).setter;
  return state.phase === "guessing" ? other(setter) : setter;
}

export function hangmanStatus(state: HangmanState): GameStatus {
  if (state.phase !== "done") return { status: "ongoing" };
  const { first, second } = state.scores;
  if (first === second) return { status: "draw" };
  return { status: "win", winner: first > second ? "first" : "second" };
}

/** Engine shape for the shared game plumbing; moves themselves go through the API. */
export const hangman: Engine<HangmanState, string> = {
  type: "hangman",
  initialState: hangmanInitial,
  mover: hangmanMover,
  status: hangmanStatus,
  legalMoves: () => [],
  applyMove() {
    throw new Error("hangman moves are resolved by the server");
  },
};
