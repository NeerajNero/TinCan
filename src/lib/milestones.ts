/** Next-occurrence maths for milestones and the friends-since anniversary. */
import { daysBetween, isDateKey } from "@/lib/dates";
import type { DateKey, MilestoneSummary } from "@/lib/types";

export interface Upcoming {
  id: string;
  title: string;
  emoji: string;
  /** The occurrence being counted down to. */
  nextDate: DateKey;
  /** Days from `today`; negative means a non-repeating date already passed. */
  daysToGo: number;
  /** Which anniversary this is (yearly items only). */
  years: number | null;
  repeatYearly: boolean;
  derived?: boolean;
}

function withYear(key: DateKey, year: number): DateKey {
  const [, m, d] = key.split("-");
  // 29 Feb on a non-leap year → 28 Feb
  const feb29 = m === "02" && d === "29" && !((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0);
  return `${year}-${m}-${feb29 ? "28" : d}`;
}

/** The next occurrence of a (possibly yearly) date on or after today. */
export function nextOccurrence(date: DateKey, repeatYearly: boolean, today: DateKey): { nextDate: DateKey; years: number | null } {
  if (!repeatYearly) return { nextDate: date, years: null };
  const todayYear = Number(today.slice(0, 4));
  const startYear = Number(date.slice(0, 4));
  let next = withYear(date, todayYear);
  if (daysBetween(today, next) < 0) next = withYear(date, todayYear + 1);
  return { nextDate: next, years: Number(next.slice(0, 4)) - startYear };
}

export function toUpcoming(m: MilestoneSummary, today: DateKey, derived = false): Upcoming {
  const { nextDate, years } = nextOccurrence(m.date, m.repeatYearly, today);
  return { id: m.id, title: m.title, emoji: m.emoji, nextDate, daysToGo: daysBetween(today, nextDate), years, repeatYearly: m.repeatYearly, derived };
}

/** The since-date becomes a yearly anniversary item without being stored; wording comes from the relationship preset. */
export function friendsSinceMilestone(friendsSince: DateKey | null | undefined, preset: { anniversaryLabel: string; emoji: string }): MilestoneSummary | null {
  if (!friendsSince || !isDateKey(friendsSince)) return null;
  return { id: "friends-since", title: preset.anniversaryLabel, emoji: preset.emoji, date: friendsSince, repeatYearly: true };
}

/** "Friends for 3 years", "Lovebirds for 1 year". */
export function yearsLine(years: number, pairNoun: string): string {
  const noun = pairNoun.charAt(0).toUpperCase() + pairNoun.slice(1);
  return `${noun} for ${years} ${years === 1 ? "year" : "years"}`;
}

/** Upcoming first (soonest), then past one-offs (most recent first). */
export function sortUpcoming(list: Upcoming[]): Upcoming[] {
  return [...list].sort((a, b) => {
    const aPast = a.daysToGo < 0;
    const bPast = b.daysToGo < 0;
    if (aPast !== bPast) return aPast ? 1 : -1;
    return aPast ? b.daysToGo - a.daysToGo : a.daysToGo - b.daysToGo;
  });
}

export function nextUp(summary: MilestoneSummary[] | undefined, friendsSince: DateKey | null | undefined, today: DateKey, preset: { anniversaryLabel: string; emoji: string }): Upcoming | null {
  const all = [...(summary ?? []).map((m) => toUpcoming(m, today))];
  const fs = friendsSinceMilestone(friendsSince, preset);
  if (fs) all.push(toUpcoming(fs, today, true));
  return sortUpcoming(all).find((u) => u.daysToGo >= 0) ?? null;
}
