/**
 * Notes (phase 27): a one-line status in a speech bubble over the avatar,
 * gone after 24 hours. Stored on `users/{uid}.note`; the pure parts live here.
 */
import type { Message, UserNote } from "@/lib/types";

export const NOTE_MAX = 60;
export const NOTE_TTL_MS = 24 * 60 * 60_000;
export const NOTE_EMOJI = ["📝", "☕", "🎧", "🏃", "😴", "🍜", "📚", "💛"] as const;

type NoteLike = { text?: string; emoji?: string; expiresAt?: { toMillis(): number } | null };

/** A note worth showing: has text and hasn't expired. */
export function noteVisible(note: NoteLike | null | undefined, nowMs: number): note is NoteLike {
  if (!note || typeof note.text !== "string" || !note.text.trim()) return false;
  const until = note.expiresAt?.toMillis?.();
  return typeof until === "number" && until > nowMs;
}

/** The tick's view: a stored note whose time is up (null / missing notes need nothing). */
export function noteExpired(note: NoteLike | null | undefined, nowMs: number): boolean {
  if (!note) return false;
  const until = note.expiresAt?.toMillis?.();
  return typeof until !== "number" || until <= nowMs;
}

/** Text as the bubble and the push show it: emoji first, trimmed, capped. */
export function noteLine(note: Pick<UserNote, "text" | "emoji">): string {
  const text = note.text.trim().slice(0, NOTE_MAX);
  return note.emoji ? `${note.emoji} ${text}` : text;
}

/** Reply strip for the chat: the friend's note as a pseudo message (its id never resolves to a doc; the quote renders from the stored preview). */
export function noteAsMessage(friendUid: string, note: Pick<UserNote, "text" | "emoji"> & { at?: { toMillis(): number } | null }): Message {
  const at = note.at?.toMillis?.() ?? Date.now();
  return {
    id: `note:${friendUid}:${at}`,
    senderId: friendUid,
    type: "text",
    text: noteLine(note),
    reactions: {},
    status: "sent",
    deliveredAt: null,
    readAt: null,
    deletedFor: [],
    deletedForEveryone: false,
    createdAt: null,
    pending: false,
    createdAtMs: at,
  };
}

export const isNoteReply = (id: string): boolean => id.startsWith("note:");
