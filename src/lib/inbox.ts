/**
 * The notifications inbox (phase 28): every push the server composes for a
 * person also lands as a row in `inbox/{uid}/items`, whether or not the push
 * itself goes out (push is optional here; the app is opened deliberately).
 * The bell in every tab header shows `users/{uid}.inbox.unread`; opening the
 * sheet zeroes it and stamps `lastReadAt`. Pure parts live here so the server
 * (`lib/server/push.ts`), the client (`components/shell/Inbox*`) and the unit
 * tests share them.
 */
import type { PushType } from "@/lib/pushTypes";

/** Rows per page in the sheet (one read each, only when it is open). */
export const INBOX_PAGE = 30;
/** Rows kept per person; the 03:00 tick deletes the rest. */
export const INBOX_KEEP = 200;
/** A bursty push of the same type within this window of the latest unread row updates that row instead of adding one. */
export const INBOX_BURST_MS = 10 * 60_000;
/** The badge caps here ("99+"). */
export const INBOX_BADGE_MAX = 99;

/** Pushes that never land in the inbox: the test button, and the morning digest (a summary of what is already here). */
const INBOX_SKIP: ReadonlySet<PushType> = new Set<PushType>(["test", "digest"]);
/** Types that arrive in bursts and collapse into one row with a count. */
const INBOX_BURSTY: ReadonlySet<PushType> = new Set<PushType>(["message", "scheduled", "ping", "lamp", "yourTurn"]);

/** Whether a push of this type is recorded in the recipient's inbox. */
export function inboxRecords(type: PushType): boolean {
  return !INBOX_SKIP.has(type);
}

/** The bell badge: empty at zero, the count up to 99, then "99+". */
export function formatBadge(unread: number | null | undefined): string {
  if (!unread || unread <= 0 || !Number.isFinite(unread)) return "";
  return unread > INBOX_BADGE_MAX ? `${INBOX_BADGE_MAX}+` : String(Math.floor(unread));
}

/** `users/{me}.inbox.unread`, tolerant of a missing map. */
export function inboxUnread(me: { inbox?: { unread?: number } | null } | null | undefined): number {
  const n = me?.inbox?.unread;
  return typeof n === "number" && n > 0 ? n : 0;
}

export interface InboxLatest {
  type: PushType;
  /** The row's `createdAt` in ms (0 when the server timestamp is still pending). */
  createdAtMs: number;
}

/**
 * Collapse rule: the latest row is the same bursty type, still unread (newer
 * than `lastReadMs`) and younger than the burst window → update it (count + 1,
 * latest body, bumped to the top) instead of adding a row.
 */
export function shouldCollapse(latest: InboxLatest | null, type: PushType, nowMs: number, lastReadMs: number | null): boolean {
  if (!latest || !INBOX_BURSTY.has(type) || latest.type !== type) return false;
  if (lastReadMs !== null && latest.createdAtMs <= lastReadMs) return false;
  return nowMs - latest.createdAtMs < INBOX_BURST_MS;
}

/** A row is unread while it is newer than the `lastReadAt` the sheet opened with; a pending server timestamp counts as new. */
export function inboxItemUnread(item: { createdAt: { toMillis(): number } | null }, sinceMs: number | null): boolean {
  if (!item.createdAt) return true;
  return sinceMs === null || item.createdAt.toMillis() > sinceMs;
}

/** The owner's only write to `users/{me}.inbox`: zero the count and stamp the read time (the rule allows exactly this). */
export function markReadPatch<T>(serverTime: T): { "inbox.unread": 0; "inbox.lastReadAt": T } {
  return { "inbox.unread": 0, "inbox.lastReadAt": serverTime };
}

/** The glyph on each row (titles are often just the friend's nickname). */
export const INBOX_EMOJI: Record<PushType, string> = {
  message: "💬",
  ping: "👋",
  lamp: "💡",
  test: "🔔",
  "daily-answer": "✍️",
  "daily-nudge": "💭",
  "streak-risk": "🔥",
  "capsule-unlocked": "⏳",
  "envelope-opened": "💌",
  jar: "🫙",
  scheduled: "⏰",
  milestone: "🎉",
  meetup: "✈️",
  yourTurn: "🎲",
  invite: "🎯",
  petHungry: "🍽️",
  digest: "☀️",
  "rules-drift": "⚠️",
  snap: "📸",
  note: "📝",
};
