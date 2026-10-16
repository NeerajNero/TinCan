/**
 * Date-key helpers. A `dateKey` is a calendar date as `yyyy-MM-dd` in a specific
 * time zone. Shared daily things (daily question, word, check-ins, streak) use the
 * room's zone (`pair/main.roomTz`); per-person things (mood) use that person's own
 * zone (`users/{uid}.tz`).
 */
import { formatInTimeZone } from "date-fns-tz";

import type { DateKey, PairDoc } from "@/lib/types";

const DATE_KEY_FORMAT = "yyyy-MM-dd";
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

/** Today's (or `at`'s) date key in an IANA zone. */
export function dateKeyIn(tz: string, at: Date = new Date()): DateKey {
  return formatInTimeZone(at, tz, DATE_KEY_FORMAT);
}

/** Date key on the shared room calendar. */
export function roomDateKey(pair: Pick<PairDoc, "roomTz">, at?: Date): DateKey {
  return dateKeyIn(pair.roomTz, at);
}

/** Minutes since local midnight in a zone (0–1439). */
export function minutesIntoDayIn(tz: string, at: Date = new Date()): number {
  return Number(formatInTimeZone(at, tz, "H")) * 60 + Number(formatInTimeZone(at, tz, "m"));
}

export function isDateKey(value: unknown): value is DateKey {
  return typeof value === "string" && DATE_KEY_RE.test(value) && !Number.isNaN(dateKeyToUtcMs(value));
}

/* ── Arithmetic on date keys (zone-free, since a key is already a calendar day) ── */

function parts(key: DateKey): [number, number, number] {
  const [y = NaN, m = NaN, d = NaN] = key.split("-").map(Number);
  return [y, m, d];
}

function dateKeyToUtcMs(key: DateKey): number {
  const [y, m, d] = parts(key);
  return Date.UTC(y, m - 1, d);
}

/** Whole days since 1970-01-01 — handy for "index = days mod list length". */
export function daysSinceEpoch(key: DateKey): number {
  return Math.floor(dateKeyToUtcMs(key) / MS_PER_DAY);
}

/** `to - from` in whole days; negative when `to` is earlier. */
export function daysBetween(from: DateKey, to: DateKey): number {
  return daysSinceEpoch(to) - daysSinceEpoch(from);
}

export function addDays(key: DateKey, days: number): DateKey {
  const date = new Date(dateKeyToUtcMs(key) + days * MS_PER_DAY);
  return date.toISOString().slice(0, 10);
}

/** The key for the day before `key`. */
export function previousDay(key: DateKey): DateKey {
  return addDays(key, -1);
}

/**
 * A `Date` at local midnight for a key — only for display formatting with
 * date-fns (`format(dateKeyToLocalDate(key), "d MMM")`). Never store it.
 */
export function dateKeyToLocalDate(key: DateKey): Date {
  const [y, m, d] = parts(key);
  return new Date(y, m - 1, d);
}

/** Doc id for per-person-per-day collections like `moods` and `wordle`. */
export function dayUserId(key: DateKey, uid: string): string {
  return `${key}_${uid}`;
}
