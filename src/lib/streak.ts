/** Pure streak maths, shared by the Home transaction and the unit tests. */
import { previousDay } from "@/lib/dates";
import type { DateKey, Streak } from "@/lib/types";

/**
 * The streak after both friends checked in on `today`. Consecutive room-days
 * extend it, a gap restarts it at 1, and a repeat of the same day is a no-op
 * (returns the previous value untouched).
 */
export function nextStreak(prev: Streak | undefined, today: DateKey): Streak {
  if (prev?.lastDateKey === today) return prev;
  const count = prev && prev.lastDateKey === previousDay(today) ? prev.count + 1 : 1;
  return { count, lastDateKey: today };
}
