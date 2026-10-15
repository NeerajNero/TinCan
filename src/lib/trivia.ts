/** Trivia duel: 10 seeded questions, 15 s each, score = correct + speed bonus. */
import bank from "@/content/trivia.json";
import { seededOrder } from "@/lib/seeded";

export interface TriviaQuestion {
  id: number;
  category: string;
  q: string;
  options: string[];
  /** Index into options. */
  answer: number;
}

export const TRIVIA_BANK = bank as TriviaQuestion[];
export const ROUND_SIZE = 10;
export const QUESTION_MS = 15_000;
export const POINTS_CORRECT = 10;
export const SPEED_BONUS_MAX = 5;

export function pickQuestionIds(seed: number): number[] {
  return seededOrder(TRIVIA_BANK.length, seed).slice(0, ROUND_SIZE);
}

/** Options shuffled per question per seed so A isn't always right, with the correct index remapped. */
export function shuffledOptions(q: TriviaQuestion, seed: number): { options: string[]; answer: number } {
  const order = seededOrder(q.options.length, seed + q.id);
  const options = order.map((i) => q.options[i]);
  return { options, answer: order.indexOf(q.answer) };
}

export interface TriviaAnswer {
  /** Chosen (shuffled) index, or -1 for timeout. */
  choice: number;
  /** Milliseconds taken. */
  ms: number;
  correct: boolean;
}

export function pointsFor(a: TriviaAnswer): number {
  if (!a.correct) return 0;
  const bonus = Math.round(SPEED_BONUS_MAX * Math.max(0, 1 - a.ms / QUESTION_MS));
  return POINTS_CORRECT + bonus;
}

export const totalScore = (answers: TriviaAnswer[]) => answers.reduce((s, a) => s + pointsFor(a), 0);
