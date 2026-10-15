import questions from "@/content/daily-questions.json";
import { daysSinceEpoch } from "@/lib/dates";
import type { DateKey } from "@/lib/types";

export const DAILY_QUESTIONS: readonly string[] = questions;

/** Same question for both friends on a given room-day. */
export function questionIndexFor(dateKey: DateKey): number {
  return ((daysSinceEpoch(dateKey) % DAILY_QUESTIONS.length) + DAILY_QUESTIONS.length) % DAILY_QUESTIONS.length;
}

export function questionFor(dateKey: DateKey): string {
  return DAILY_QUESTIONS[questionIndexFor(dateKey)];
}

export function questionAt(index: number): string {
  return DAILY_QUESTIONS[((index % DAILY_QUESTIONS.length) + DAILY_QUESTIONS.length) % DAILY_QUESTIONS.length];
}
