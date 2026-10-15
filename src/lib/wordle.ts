/** Daily word: same answer for both by ROOM_TZ date; guesses checked against the allowed list. */
import allowed from "@/content/words-allowed.json";
import answers from "@/content/words-answers.json";
import { hashSeed } from "@/lib/seeded";

export const WORD_LEN = 5;
export const MAX_GUESSES = 6;
const ALLOWED = new Set<string>([...(allowed as string[]), ...(answers as string[])]);

export function wordFor(dateKey: string): string {
  const list = answers as string[];
  return list[hashSeed(`tincan-word-${dateKey}`) % list.length];
}

export const isAllowedGuess = (w: string) => ALLOWED.has(w.toLowerCase());

export type LetterState = "correct" | "present" | "absent";

/** Wordle colouring with correct handling of repeated letters. */
export function evaluate(guess: string, answer: string): LetterState[] {
  const g = guess.toLowerCase().split("");
  const a = answer.toLowerCase().split("");
  const result: LetterState[] = Array(WORD_LEN).fill("absent");
  const remaining: Record<string, number> = {};
  for (let i = 0; i < WORD_LEN; i++) {
    if (g[i] === a[i]) result[i] = "correct";
    else remaining[a[i]] = (remaining[a[i]] ?? 0) + 1;
  }
  for (let i = 0; i < WORD_LEN; i++) {
    if (result[i] === "correct") continue;
    if (remaining[g[i]] > 0) {
      result[i] = "present";
      remaining[g[i]] -= 1;
    }
  }
  return result;
}

/** Best known state per letter, for the on-screen keyboard. */
export function keyboardStates(guesses: string[], answer: string): Record<string, LetterState> {
  const rank: Record<LetterState, number> = { absent: 0, present: 1, correct: 2 };
  const out: Record<string, LetterState> = {};
  for (const guess of guesses) {
    const states = evaluate(guess, answer);
    guess.split("").forEach((ch, i) => {
      if (!out[ch] || rank[states[i]] > rank[out[ch]]) out[ch] = states[i];
    });
  }
  return out;
}

export const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
