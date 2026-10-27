/**
 * "On this day" look-backs: the same calendar day one year and one month ago,
 * clamped to the end of a shorter month (31 Mar → 28/29 Feb, 29 Feb → 28 Feb).
 */
import type { DateKey } from "@/lib/types";

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const daysInMonth = (y: number, m: number) => [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]!;
const pad = (n: number) => String(n).padStart(2, "0");

function clamp(y: number, m: number, d: number): DateKey {
  return `${y}-${pad(m)}-${pad(Math.min(d, daysInMonth(y, m)))}`;
}

export function oneYearAgo(today: DateKey): DateKey {
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  return clamp(y - 1, m, d);
}

export function oneMonthAgo(today: DateKey): DateKey {
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  return m === 1 ? clamp(y - 1, 12, d) : clamp(y, m - 1, d);
}

export type LookbackSpan = "year" | "month";
export const LOOKBACKS: ReadonlyArray<{ span: LookbackSpan; label: string; date: (today: DateKey) => DateKey }> = [
  { span: "year", label: "1 year ago", date: oneYearAgo },
  { span: "month", label: "1 month ago", date: oneMonthAgo },
];
