/**
 * Daily snap (phase 27), the pure parts: when today's minute is picked, how
 * late a post is, what the Home card shows and the both-posted streak. The
 * tick schedules, the clients post (`lib/db/snaps.ts`), `pnpm test` covers
 * this file.
 */
import { daysBetween } from "@/lib/dates";
import type { DateKey, SnapSchedule, SnapStreak, SnapSummaryDoc } from "@/lib/types";

/** Both have this long after the minute before a post counts as late. */
export const SNAP_WINDOW_MS = 2 * 60_000;
export const SNAP_CAPTION_MAX = 60;
/** Entries older than this are swept unless saved to memories. */
export const SNAP_RETENTION_DAYS = 60;
/** The minute is drawn uniformly from [09:00, 22:00) ROOM_TZ. */
export const SNAP_EARLIEST_MIN = 9 * 60;
export const SNAP_LATEST_MIN = 22 * 60;
export const SNAPS_PAGE = 30;

/**
 * Today's snap minute (minutes into the room day) from a uniform `rand` in
 * [0, 1). `notBefore` lets a tick that runs late in the day still pick a
 * future minute; null when the day's range is already behind us.
 */
export function pickSnapMinute(rand: number, notBefore = SNAP_EARLIEST_MIN): number | null {
  const from = Math.max(SNAP_EARLIEST_MIN, Math.ceil(notBefore));
  if (from >= SNAP_LATEST_MIN) return null;
  const r = Math.min(0.999999, Math.max(0, rand));
  return from + Math.floor(r * (SNAP_LATEST_MIN - from));
}

/** Milliseconds of the 2-minute window still left (0 once it has passed, or before the minute). */
export function snapWindowLeftMs(todayAt: number, now: number): number {
  if (now < todayAt) return 0;
  return Math.max(0, todayAt + SNAP_WINDOW_MS - now);
}

/** Inside the window → on time; after it → late by whole minutes, rounded up. */
export function snapLateness(todayAt: number, now: number): { late: boolean; lateByMin: number } {
  const over = now - (todayAt + SNAP_WINDOW_MS);
  if (over <= 0) return { late: false, lateByMin: 0 };
  return { late: true, lateByMin: Math.max(1, Math.ceil(over / 60_000)) };
}

/** "1:32" for a countdown. */
export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * What the Home card shows:
 * - hidden: no snap scheduled for today yet, or the minute hasn't come
 * - open: the 2-minute window is running and I haven't posted
 * - late: the window has passed and I haven't posted (Post still works, marked late)
 * - waiting: I posted, the friend hasn't
 * - both: both posted
 * A day that ended with nobody or one posting is simply a new day's "hidden".
 */
export type SnapCardState = "hidden" | "open" | "late" | "waiting" | "both";

export function snapCardState(schedule: SnapSchedule | null | undefined, summary: SnapSummaryDoc | null | undefined, uid: string, friendUid: string | null, today: DateKey, now: number): SnapCardState {
  if (!schedule || schedule.todayKey !== today || now < schedule.todayAt) return "hidden";
  const mine = summary?.posted?.[uid] === true;
  const theirs = Boolean(friendUid && summary?.posted?.[friendUid] === true);
  if (mine && theirs) return "both";
  if (mine) return "waiting";
  return now < schedule.todayAt + SNAP_WINDOW_MS ? "open" : "late";
}

/** The snap card is pinned to the top of Home while it's my move to post. */
export const snapPinned = (state: SnapCardState): boolean => state === "open" || state === "late";

/**
 * The streak after both posted on `today`: a consecutive room-day extends it,
 * anything else restarts at 1; `best` keeps the longest. Same day → unchanged.
 */
export function nextSnapStreak(prev: SnapStreak | undefined, today: DateKey): SnapStreak {
  if (prev?.lastDateKey === today) return prev;
  const count = prev && daysBetween(prev.lastDateKey, today) === 1 ? prev.count + 1 : 1;
  return { count, lastDateKey: today, best: Math.max(prev?.best ?? 0, count) };
}

/**
 * What the transaction writes, or null when nothing should change: only a
 * day on which both uids posted counts, and only once (whichever client
 * sees both first wins; the other finds `lastDateKey === today`).
 */
export function snapStreakAfter(prev: SnapStreak | undefined, today: DateKey, summary: Pick<SnapSummaryDoc, "posted"> | null | undefined, uids: readonly string[]): SnapStreak | null {
  if (uids.length < 2 || !uids.every((u) => summary?.posted?.[u] === true)) return null;
  if (prev?.lastDateKey === today) return null;
  return nextSnapStreak(prev, today);
}

/** 🔥 shows from two days on. */
export const SNAP_STREAK_SHOW_FROM = 2;
