/**
 * Daily snap (phase 27), the pure parts: when today's minute is picked, how
 * late a post is, what the Home card shows and the both-posted streak. The
 * tick schedules, the clients post (`lib/db/snaps.ts`), `pnpm test` covers
 * this file.
 */
import { daysBetween } from "@/lib/dates";
import type { DateKey, SnapSchedule, SnapStreak, SnapSummaryDoc } from "@/lib/types";

/** The prompt's countdown: a post inside it is `onTime`, after it `later`. */
export const SNAP_WINDOW_MS = 2 * 60_000;
/** localStorage: the room day whose takeover was dismissed on this device. */
export const SNAP_DISMISS_KEY = "tincan:snap-dismissed";
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

/** Milliseconds left until `deadline` (the prompt's two minutes), never negative. */
export function snapWindowLeftMs(deadline: number, now: number): number {
  return Math.max(0, deadline - now);
}

/** Posted before the deadline → onTime; after it (or with no deadline, e.g. from the Home card) → later. */
export function snapTiming(deadline: number | null, now: number): { onTime: boolean; later: boolean } {
  const onTime = deadline !== null && now <= deadline;
  return { onTime, later: !onTime };
}

/** "1:32" for a countdown. */
export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * What the Home card shows:
 * - hidden: no snap scheduled for today yet, or the minute hasn't come
 * - due: the minute has come and I haven't posted ("Post today's snap"; the takeover shows unless dismissed)
 * - waiting: I posted, the friend hasn't
 * - both: both posted
 * A day that ended with nobody or one posting is simply a new day's "hidden".
 */
export type SnapCardState = "hidden" | "due" | "waiting" | "both";

export function snapCardState(schedule: SnapSchedule | null | undefined, summary: SnapSummaryDoc | null | undefined, uid: string, friendUid: string | null, today: DateKey, now: number): SnapCardState {
  if (!schedule || schedule.todayKey !== today || now < schedule.todayAt) return "hidden";
  const mine = summary?.posted?.[uid] === true;
  const theirs = Boolean(friendUid && summary?.posted?.[friendUid] === true);
  if (mine && theirs) return "both";
  if (mine) return "waiting";
  return "due";
}

/** The snap card is pinned to the top of Home while it's my move to post. */
export const snapPinned = (state: SnapCardState): boolean => state === "due";

/**
 * The full-screen takeover shows on open (and on resume) when today's minute
 * has come, my entry for today doesn't exist, and this device hasn't
 * dismissed today's prompt. Dismissing leaves the Home card's button for the
 * rest of the day; a new room day starts over.
 */
export function snapTakeoverDue(args: { schedule: SnapSchedule | null | undefined; summary: Pick<SnapSummaryDoc, "posted"> | null | undefined; uid: string; today: DateKey; now: number; dismissedFor: string | null }): boolean {
  const { schedule, summary, uid, today, now, dismissedFor } = args;
  if (!schedule || schedule.todayKey !== today || now < schedule.todayAt) return false;
  if (summary?.posted?.[uid] === true) return false;
  return dismissedFor !== today;
}

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
