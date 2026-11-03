/**
 * Plan → Upcoming (phase 29): the agenda for the next days merges `events/*`
 * with milestones (incl. imported festivals and the friendiversary), the
 * festival seed entries not yet imported, and trips — the last three derived
 * from the docs that already exist, never duplicated. Pure, so the merge,
 * the grouping, the countdown selection and the mirrored summary are unit
 * tested from fixtures. Day boundaries are ROOM_TZ date keys throughout: the
 * caller passes `today` from `roomDateKey`, and every item carries date keys.
 */
import { format } from "date-fns";

import { addDays, dateKeyToLocalDate, daysBetween, isDateKey } from "@/lib/dates";
import { alreadyPresent, festivalMilestones, type ExistingMilestone } from "@/lib/festivals";
import { resolveCountdown, type CountdownTarget } from "@/lib/meetup";
import { friendsSinceMilestone } from "@/lib/milestones";
import { EVENT_BOTH, type CountdownSummary, type DateKey, type EventDoc, type MilestoneSummary, type PairDoc, type TripSummary } from "@/lib/types";

/** The inline agenda on Plan. */
export const UPCOMING_INLINE_DAYS = 7;
/** The window "See all" opens with; "Load more" extends it. */
export const UPCOMING_WINDOW_DAYS = 30;
export const UPCOMING_MAX_DAYS = 400;
/** The Plan listener: events from today on, this many at most. */
export const EVENTS_PAGE = 50;
export const EVENT_TITLE_MAX = 60;
export const EVENT_NOTE_MAX = 200;
export const EVENT_EMOJI = ["📅", "🎂", "📚", "✈️", "🏥", "💼", "🎉", "🏃", "🎬", "🍽️", "🛌", "⛔"] as const;
const BUSY_TITLE = "Busy";
const BUSY_EMOJI = "⛔";

type AgendaSource = "event" | "milestone" | "festival" | "trip";

export interface AgendaItem {
  /** Unique per day row. */
  key: string;
  source: AgendaSource;
  id: string;
  title: string;
  emoji: string;
  /** The day this row sits on. */
  date: DateKey;
  startDate: DateKey;
  endDate: DateKey | null;
  /** "HH:mm" or null for all-day. */
  time: string | null;
  note: string;
  /** A uid, or "both". Milestones, festivals and trips are always "both". */
  who: string;
  countdown: boolean;
  /** "Day 2 of 5" for multi-day spans. */
  spanLabel: string | null;
}

export interface AgendaDay {
  date: DateKey;
  isToday: boolean;
  items: AgendaItem[];
}

export interface EventWithId extends EventDoc {
  id: string;
}

export interface AgendaSource$ {
  events: EventWithId[];
  milestones: MilestoneSummary[] | undefined;
  friendsSince: DateKey | null | undefined;
  preset: { anniversaryLabel: string; emoji: string };
  trips: TripSummary[] | undefined;
  /** First day of the window (usually today). */
  from: DateKey;
  /** Days in the window, inclusive of `from`. */
  days: number;
  today: DateKey;
}

const clampDays = (n: number) => Math.max(1, Math.min(UPCOMING_MAX_DAYS, Math.floor(n)));

/** Rows for one spanning item: a row per day it covers inside [from, to]. */
function spanRows(base: Omit<AgendaItem, "key" | "date" | "spanLabel">, from: DateKey, to: DateKey): AgendaItem[] {
  const start = base.startDate;
  const end = base.endDate ?? base.startDate;
  if (!isDateKey(start) || !isDateKey(end) || end < start) return [];
  const total = daysBetween(start, end) + 1;
  const first = start > from ? start : from;
  const last = end < to ? end : to;
  if (last < first) return [];
  const out: AgendaItem[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) {
    const n = daysBetween(start, d) + 1;
    out.push({ ...base, key: `${base.source}:${base.id}:${d}`, date: d, spanLabel: total > 1 ? `Day ${n} of ${total}` : null });
  }
  return out;
}

function eventRows(events: EventWithId[], from: DateKey, to: DateKey): AgendaItem[] {
  return events.flatMap((e) =>
    spanRows(
      { source: "event", id: e.id, title: e.title, emoji: e.emoji || "📅", startDate: e.date, endDate: e.endDate ?? null, time: e.time ?? null, note: e.note ?? "", who: e.who || EVENT_BOTH, countdown: e.countdown === true },
      from,
      to,
    ),
  );
}

/** Every occurrence of a (possibly yearly) date inside [from, to]. */
function occurrencesIn(date: DateKey, repeatYearly: boolean, from: DateKey, to: DateKey): DateKey[] {
  if (!isDateKey(date)) return [];
  if (!repeatYearly) return date >= from && date <= to ? [date] : [];
  const out: DateKey[] = [];
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
    const [, m, d] = date.split("-");
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const key = `${y}-${m}-${m === "02" && d === "29" && !leap ? "28" : d}`;
    if (key >= from && key <= to) out.push(key);
  }
  return out;
}

function milestoneRows(summary: MilestoneSummary[] | undefined, friendsSince: DateKey | null | undefined, preset: AgendaSource$["preset"], from: DateKey, to: DateKey): AgendaItem[] {
  const all = [...(summary ?? [])];
  const fs = friendsSinceMilestone(friendsSince, preset);
  if (fs) all.push(fs);
  return all.flatMap((m) =>
    occurrencesIn(m.date, m.repeatYearly, from, to).map((d) => ({
      key: `milestone:${m.id}:${d}`,
      source: "milestone" as const,
      id: m.id,
      title: m.title,
      emoji: m.emoji || "🎉",
      date: d,
      startDate: d,
      endDate: null,
      time: null,
      note: "",
      who: EVENT_BOTH,
      countdown: false,
      spanLabel: null,
    })),
  );
}

/** Festivals from the seed that are not milestones yet (once imported they come through `milestoneRows`). */
function festivalRows(existing: ExistingMilestone[], from: DateKey, to: DateKey): AgendaItem[] {
  return festivalMilestones().flatMap((f) => {
    if (alreadyPresent(existing, f)) return [];
    return occurrencesIn(f.date, f.repeatYearly, from, to).map((d) => ({
      key: `festival:${f.title}:${d}`,
      source: "festival" as const,
      id: f.title,
      title: f.title,
      emoji: f.emoji,
      date: d,
      startDate: d,
      endDate: null,
      time: null,
      note: "",
      who: EVENT_BOTH,
      countdown: false,
      spanLabel: null,
    }));
  });
}

function tripRows(trips: TripSummary[] | undefined, from: DateKey, to: DateKey): AgendaItem[] {
  return (trips ?? []).flatMap((t) =>
    spanRows({ source: "trip", id: t.id, title: t.title, emoji: "🧳", startDate: t.startDate, endDate: t.endDate || t.startDate, time: null, note: t.place, who: EVENT_BOTH, countdown: false }, from, to),
  );
}

/** All-day rows first, then by time; ties by source (events first) then title. */
const SOURCE_ORDER: Record<AgendaSource, number> = { event: 0, trip: 1, milestone: 2, festival: 3 };
function compareItems(a: AgendaItem, b: AgendaItem): number {
  if ((a.time === null) !== (b.time === null)) return a.time === null ? -1 : 1;
  if (a.time && b.time && a.time !== b.time) return a.time < b.time ? -1 : 1;
  if (SOURCE_ORDER[a.source] !== SOURCE_ORDER[b.source]) return SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
  return a.title.localeCompare(b.title);
}

/** The merged agenda, grouped by day, days with nothing left out. */
export function buildAgenda(src: AgendaSource$): AgendaDay[] {
  const days = clampDays(src.days);
  const to = addDays(src.from, days - 1);
  const existing: ExistingMilestone[] = (src.milestones ?? []).map((m) => ({ title: m.title, date: m.date, repeatYearly: m.repeatYearly }));
  const rows = [
    ...eventRows(src.events, src.from, to),
    ...milestoneRows(src.milestones, src.friendsSince, src.preset, src.from, to),
    ...festivalRows(existing, src.from, to),
    ...tripRows(src.trips, src.from, to),
  ];
  const byDay = new Map<DateKey, AgendaItem[]>();
  for (const r of rows) byDay.set(r.date, [...(byDay.get(r.date) ?? []), r]);
  return Array.from(byDay.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, items]) => ({ date, isToday: date === src.today, items: items.sort(compareItems) }));
}

/* ── countdowns ────────────────────────────────────────────────────────── */

/** The nearest upcoming event with `countdown: true` (still running when its last day is today or later). */
export function countdownSummaryFrom(events: EventWithId[], today: DateKey): CountdownSummary | null {
  const live = events
    .filter((e) => e.countdown === true && isDateKey(e.date) && (e.endDate ?? e.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const e = live[0];
  if (!e) return null;
  return { id: e.id, title: e.title, date: e.date, who: e.who, ...(e.emoji ? { emoji: e.emoji } : {}), ...(e.endDate ? { endDate: e.endDate } : {}) };
}

/** Whether the mirrored summary needs a write after a change to the events list. */
export function summaryChanged(prev: CountdownSummary | null | undefined, next: CountdownSummary | null): boolean {
  const a = prev ?? null;
  if (a === null || next === null) return a !== next;
  return a.id !== next.id || a.title !== next.title || a.date !== next.date || (a.endDate ?? null) !== (next.endDate ?? null) || (a.emoji ?? null) !== (next.emoji ?? null) || a.who !== next.who;
}

/**
 * The one selector Plan's hero and Home's card share: the nearest, by date,
 * of `pair.nextMeetup`, the nearest upcoming trip and the mirrored countdown
 * event; past targets only when nothing is ahead (so "N days ago" still shows).
 */
export function nearestCountdown(pair: Pick<PairDoc, "nextMeetup" | "tripsSummary" | "nextCountdown">, today: DateKey): CountdownTarget | null {
  const candidates: CountdownTarget[] = [];
  const m = pair.nextMeetup;
  if (m?.date && isDateKey(m.date)) candidates.push({ date: m.date, label: m.label, place: m.place, source: "meetup" });
  for (const t of pair.tripsSummary ?? []) {
    if (isDateKey(t.startDate) && daysBetween(today, t.endDate || t.startDate) >= 0) candidates.push({ date: t.startDate, label: t.title, place: t.place, source: "trip", endDate: t.endDate });
  }
  const e = pair.nextCountdown;
  if (e && isDateKey(e.date) && (e.endDate ?? e.date) >= today) candidates.push({ date: e.date, label: e.title, place: "", source: "event", ...(e.endDate ? { endDate: e.endDate } : {}), ...(e.emoji ? { emoji: e.emoji } : {}) });
  const ahead = candidates.filter((c) => (c.endDate ?? c.date) >= today).sort((a, b) => a.date.localeCompare(b.date));
  return ahead[0] ?? resolveCountdown(pair, today);
}

/* ── wording ───────────────────────────────────────────────────────────── */

/** "Exam · 14 Nov" (with "– 16 Nov" for a span): the push body and inbox row. */
export function eventLine(ev: Pick<EventDoc, "title" | "date" | "endDate">): string {
  if (!isDateKey(ev.date)) return ev.title;
  const start = format(dateKeyToLocalDate(ev.date), "d MMM");
  const end = ev.endDate && isDateKey(ev.endDate) && ev.endDate !== ev.date ? ` – ${format(dateKeyToLocalDate(ev.endDate), "d MMM")}` : "";
  return `${ev.title} · ${start}${end}`;
}

/** The agenda's day heading: "Today", "Tomorrow", else "Fri 14 Nov". */
export function dayHeading(date: DateKey, today: DateKey): string {
  const gap = daysBetween(today, date);
  if (gap === 0) return "Today";
  if (gap === 1) return "Tomorrow";
  return format(dateKeyToLocalDate(date), "EEE d MMM");
}

/** What a form edits: everything but the server fields. */
export type EventFields = Omit<EventDoc, "createdAt" | "createdBy">;

/** A "Busy" all-day event for me over a range (the "Mark busy" chip). */
export function busyEvent(uid: string, start: DateKey, end: DateKey): EventFields {
  const [a, b] = end < start ? [end, start] : [start, end];
  return { title: BUSY_TITLE, emoji: BUSY_EMOJI, date: a, ...(b !== a ? { endDate: b } : {}), who: uid, note: "", countdown: false };
}

/** Trim and bound a form's fields into an event. */
export function cleanEvent(input: EventFields): EventFields {
  const title = input.title.trim().slice(0, EVENT_TITLE_MAX);
  const endDate = input.endDate && isDateKey(input.endDate) && input.endDate > input.date ? input.endDate : undefined;
  const time = input.time && /^\d{2}:\d{2}$/.test(input.time) ? input.time : undefined;
  const emoji = input.emoji?.trim().slice(0, 8) || undefined;
  return {
    title,
    date: input.date,
    who: input.who || EVENT_BOTH,
    note: input.note.trim().slice(0, EVENT_NOTE_MAX),
    countdown: input.countdown === true,
    ...(emoji ? { emoji } : {}),
    ...(endDate ? { endDate } : {}),
    ...(time ? { time } : {}),
  };
}
