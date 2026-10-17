/**
 * The Watch / Listen side chats at RTDB roomchat/{room}/{pushId}: pure bits
 * (text rules, the trim calculation, the unread check). Separate from the main
 * chat: no push, no badge, last 50 messages kept.
 */

export type ChatRoom = "watch" | "listen";

export interface RoomMessage {
  /** Push id; sorts by creation time. */
  id: string;
  uid: string;
  text: string;
  /** Server epoch ms. */
  at: number;
}

export const ROOM_CHAT_KEEP = 50;
/**
 * The listener's window. A limitToLast(50) window can never show more than 50,
 * so it couldn't see what to trim; a few extra rows reveal the overflow (and
 * absorb two sends racing) while the drawer still shows the newest 50.
 */
export const ROOM_CHAT_WINDOW = ROOM_CHAT_KEEP + 10;
export const ROOM_TEXT_MAX = 500;

/** Trimmed text, or null when it's empty or longer than 500. */
export function cleanRoomText(raw: string): string | null {
  const text = raw.trim();
  return text.length >= 1 && text.length <= ROOM_TEXT_MAX ? text : null;
}

/** The oldest keys beyond `keep`, as a multi-path update that deletes them (null when nothing to trim). */
export function trimPatch(keys: readonly string[], keep = ROOM_CHAT_KEEP): Record<string, null> | null {
  const sorted = [...keys].sort();
  const extra = sorted.slice(0, Math.max(0, sorted.length - keep));
  return extra.length ? Object.fromEntries(extra.map((k) => [k, null])) : null;
}

/** Newest message time, optionally only from someone other than `notUid`. */
export function latestAt(messages: readonly RoomMessage[], notUid?: string): number {
  let at = 0;
  for (const m of messages) if (m.uid !== notUid && m.at > at) at = m.at;
  return at;
}
