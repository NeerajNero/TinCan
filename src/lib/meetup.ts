/** The date the countdown points at: nextMeetup, else the nearest upcoming trip. Shared by Home, Plan and the tick. */
import { daysBetween, isDateKey } from "@/lib/dates";
import type { DateKey, PairDoc } from "@/lib/types";

export interface CountdownTarget {
  date: DateKey;
  label: string;
  place: string;
  source: "meetup" | "trip";
  /** For trips, the last day. */
  endDate?: DateKey;
}

export function resolveCountdown(pair: Pick<PairDoc, "nextMeetup" | "tripsSummary">, today: DateKey): CountdownTarget | null {
  const m = pair.nextMeetup;
  if (m?.date && isDateKey(m.date)) return { date: m.date, label: m.label, place: m.place, source: "meetup" };
  const upcoming = (pair.tripsSummary ?? [])
    .filter((t) => isDateKey(t.startDate) && daysBetween(today, t.endDate || t.startDate) >= 0)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const t = upcoming[0];
  return t ? { date: t.startDate, label: t.title, place: t.place, source: "trip", endDate: t.endDate } : null;
}
