/** Pure streak maths, shared by the Home transaction, the tick and the unit tests. */
import { daysBetween, previousDay } from "@/lib/dates";
import type { DateKey, Streak } from "@/lib/types";

export const MAX_SHIELDS = 3;
/** A shield is earned each time the count reaches a multiple of this. */
const SHIELD_EVERY = 7;

/**
 * The streak after both friends checked in on `today`. Consecutive room-days
 * extend it; a single missed day is covered by a shield when one is held
 * (`shieldUsedOn` = the missed day); any other gap restarts it at 1 (shields
 * are kept). Reaching a multiple of 7 earns a shield, up to 3. `best` and
 * `monthBest` track the longest run. A repeat of the same day is a no-op
 * (returns the previous value untouched).
 */
export function nextStreak(prev: Streak | undefined, today: DateKey): Streak {
  if (prev?.lastDateKey === today) return prev;
  const gap = prev ? daysBetween(prev.lastDateKey, today) : Infinity;
  let shields = prev?.shields ?? 0;
  let count: number;
  let shieldUsedOn: DateKey | null = null;
  if (prev && gap === 1) {
    count = prev.count + 1;
  } else if (prev && gap === 2 && shields > 0) {
    count = prev.count + 1;
    shields -= 1;
    shieldUsedOn = previousDay(today);
  } else {
    count = 1;
  }
  if (count % SHIELD_EVERY === 0) shields = Math.min(MAX_SHIELDS, shields + 1);
  return {
    count,
    lastDateKey: today,
    best: Math.max(prev?.best ?? 0, count),
    monthBest: Math.max(prev?.monthBest ?? 0, count),
    shields,
    shieldUsedOn,
  };
}

/** True on the day after a shield covered a miss (for the one-time toast). */
export function shieldSavedToday(streak: Streak | undefined, today: DateKey): boolean {
  return Boolean(streak && streak.lastDateKey === today && streak.shieldUsedOn === previousDay(today));
}

/**
 * Wilted when a day was missed: the last counted day is older than yesterday,
 * unless that gap is exactly one missed day and a shield is held to cover it.
 */
export function isStreakWilted(streak: Streak | undefined, today: DateKey): boolean {
  if (!streak) return false;
  const gap = daysBetween(streak.lastDateKey, today);
  if (gap <= 1) return false;
  return !(gap === 2 && (streak.shields ?? 0) > 0);
}
