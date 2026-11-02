/**
 * The digest: one push per person at their chosen hour (the tick), and the
 * same items as Home's in-app digest card (phase 27b), so the two stay in
 * sync. Pure, so the tick's assembly is unit-tested from fixtures.
 */

export interface DigestInput {
  /** Games where it's this person's move. */
  yourTurn: number;
  /** Open invites waiting for this person. */
  invites: number;
  /** Undrawn jar notes for this person (capped by the caller, ≤ 10). */
  jarNotes: number;
  dailyUnanswered: boolean;
  /** Food / joy 0–100, or null without a pet. */
  pet: { name: string; food: number; joy: number } | null;
  capsulesToday: number;
  /** Titles of milestones falling today. */
  milestonesToday: string[];
  unread: number;
  /** Today's snap minute (plus its window) has passed and this person hasn't posted. */
  snapWaiting?: boolean;
  /* In-app only (Home knows these from its listeners; the tick leaves them out): */
  /** The friend posted today's snap since the last open. */
  friendSnapPosted?: boolean;
  /** The friend posted a note since the last open (its line). */
  friendNote?: string | null;
  /** The friend answered today's question since the last open. */
  friendAnswered?: boolean;
  /** The friend dropped a note in my jar / drew one of mine since the last open. */
  jarAdded?: boolean;
  jarDrawn?: boolean;
}

export interface DigestItem {
  key: string;
  emoji: string;
  text: string;
  /** Where the chip goes. */
  url: string;
}

const PET_LOW = 30;

const n = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** The digest's items in display order; empty when there is nothing to say. Shared by the push and the Home card. */
export function digestItems(d: DigestInput, friendName = "your friend"): DigestItem[] {
  const items: DigestItem[] = [];
  if (d.yourTurn > 0) items.push({ key: "turn", emoji: "🎲", text: d.yourTurn === 1 ? "your turn in a game" : `your turn in ${d.yourTurn} games`, url: "/play" });
  if (d.invites > 0) items.push({ key: "invites", emoji: "🎮", text: d.invites === 1 ? "a game invite is waiting" : `${d.invites} game invites waiting`, url: "/play" });
  if (d.unread > 0) items.push({ key: "unread", emoji: "💬", text: n(d.unread, "unread message"), url: "/chat" });
  if (d.friendSnapPosted) items.push({ key: "snap-theirs", emoji: "📸", text: `${friendName} posted today's snap`, url: "/snap" });
  if (d.snapWaiting) items.push({ key: "snap", emoji: "📸", text: "today's snap is still waiting for yours", url: "/snap" });
  if (d.friendNote) items.push({ key: "note", emoji: "📝", text: `${friendName} left a note: ${d.friendNote}`, url: "/" });
  if (d.friendAnswered) items.push({ key: "answered", emoji: "✍️", text: `${friendName} answered today's question`, url: "/" });
  if (d.dailyUnanswered) items.push({ key: "daily", emoji: "💭", text: "today's question is waiting", url: "/" });
  if (d.jarAdded) items.push({ key: "jar-added", emoji: "🫙", text: `${friendName} dropped a note in your jar`, url: "/memories/jar" });
  if (d.jarDrawn) items.push({ key: "jar-drawn", emoji: "🫙", text: `${friendName} drew one of your jar notes`, url: "/memories/jar" });
  if (d.jarNotes > 0) items.push({ key: "jar", emoji: "🫙", text: `${n(d.jarNotes, "jar note")} to draw`, url: "/memories/jar" });
  if (d.pet) {
    const needs = [d.pet.food < PET_LOW ? "food" : null, d.pet.joy < PET_LOW ? "a play" : null].filter((x): x is string => x !== null);
    if (needs.length) items.push({ key: "pet", emoji: "🐾", text: `${d.pet.name} needs ${needs.join(" and ")}`, url: "/pet" });
  }
  if (d.capsulesToday > 0) items.push({ key: "capsules", emoji: "⏳", text: d.capsulesToday === 1 ? "a time capsule unlocks today" : `${d.capsulesToday} time capsules unlock today`, url: "/memories/capsules" });
  for (const title of d.milestonesToday) items.push({ key: `milestone:${title}`, emoji: "🎉", text: `${title} is today`, url: "/memories/milestones" });
  return items;
}

/** The push's lines: "emoji text" per item. */
export function digestLines(d: DigestInput, friendName?: string): string[] {
  return digestItems(d, friendName).map((i) => `${i.emoji} ${i.text}`);
}

/** Title + body for the push, or null when there is nothing to send. */
export function digestPush(nickname: string, d: DigestInput): { title: string; body: string } | null {
  const lines = digestLines(d);
  if (lines.length === 0) return null;
  return { title: `☀️ Good morning, ${nickname}`, body: lines.join(" · ").slice(0, 180) };
}

/** The Home card's opening words, from how long it has been. */
export function digestGreeting(sinceMs: number | null, now: number): string {
  if (sinceMs === null) return "While you were away";
  const hours = (now - sinceMs) / 3_600_000;
  if (hours < 1) return "In the last hour";
  if (hours < 20) return "Since you were last here";
  if (hours < 36) return "Since yesterday";
  return `Over the last ${Math.round(hours / 24)} days`;
}
