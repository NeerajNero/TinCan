/**
 * Weekly availability maths. Each person paints half-hour slots in their own
 * zone; to compare, every slot is projected onto concrete instants over the
 * coming week, which handles zones that are hours or half-hours apart and
 * slots that cross midnight after conversion.
 */
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { addDays, dateKeyIn } from "@/lib/dates";
import { WEEKDAY_KEYS, type AvailabilityDoc, type WeekdayKey } from "@/lib/types";

export const SLOT_MIN = 30;
export const SLOTS_PER_DAY = 24 * (60 / SLOT_MIN);

export const slotLabel = (index: number) => `${Math.floor(index / 2).toString().padStart(2, "0")}:${index % 2 ? "30" : "00"}`;
export const slotIndex = (label: string) => {
  const [h, m] = label.split(":").map(Number);
  return h * 2 + (m >= 30 ? 1 : 0);
};

/** Monday-first weekday key for a date in a zone. */
export function weekdayIn(date: Date, tz: string): WeekdayKey {
  const idx = Number(formatInTimeZone(date, tz, "i")); // 1 = Monday … 7 = Sunday
  return WEEKDAY_KEYS[idx - 1];
}

export interface Interval {
  start: number; // epoch ms
  end: number;
}

/** Concrete 30-minute intervals for the next `days` days from `now`, in absolute time. */
export function projectWeek(doc: Pick<AvailabilityDoc, "slots"> | null, tz: string, now: Date, days = 8): Interval[] {
  if (!doc) return [];
  const out: Interval[] = [];
  const startKey = dateKeyIn(tz, now);
  for (let d = 0; d < days; d++) {
    const key = addDays(startKey, d);
    const noon = fromZonedTime(`${key}T12:00:00`, tz);
    const weekday = weekdayIn(noon, tz);
    for (const label of doc.slots[weekday] ?? []) {
      const start = fromZonedTime(`${key}T${label}:00`, tz).getTime();
      out.push({ start, end: start + SLOT_MIN * 60_000 });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Intersection of two interval sets (both sorted), as 30-minute pieces. */
export function intersect(a: Interval[], b: Interval[]): Interval[] {
  const set = new Set(b.map((x) => x.start));
  return a.filter((x) => set.has(x.start));
}

export interface Window extends Interval {
  slots: number;
}

/** Merge consecutive 30-minute pieces into windows; keep those ending after `now`. */
export function toWindows(pieces: Interval[], now: Date, max = 5): Window[] {
  const windows: Window[] = [];
  for (const p of pieces) {
    const last = windows[windows.length - 1];
    if (last && last.end === p.start) {
      last.end = p.end;
      last.slots += 1;
    } else {
      windows.push({ ...p, slots: 1 });
    }
  }
  return windows.filter((w) => w.end > now.getTime()).slice(0, max);
}

/** The friend's week re-painted onto *my* weekly grid (keys in my zone) for the overlap view. */
export function remapToZone(doc: Pick<AvailabilityDoc, "slots"> | null, fromTz: string, toTz: string, now: Date): Partial<Record<WeekdayKey, Set<number>>> {
  const out: Partial<Record<WeekdayKey, Set<number>>> = {};
  for (const piece of projectWeek(doc, fromTz, now, 7)) {
    const date = new Date(piece.start);
    const day = weekdayIn(date, toTz);
    const idx = slotIndex(formatInTimeZone(date, toTz, "HH:mm"));
    (out[day] ??= new Set()).add(idx);
  }
  return out;
}

export function fmtTime(ms: number, tz: string) {
  return formatInTimeZone(new Date(ms), tz, "h:mm a");
}
export function fmtDay(ms: number, tz: string) {
  return formatInTimeZone(new Date(ms), tz, "EEE");
}
