/**
 * The morning digest: one push per person at their chosen hour, listing only
 * what exists. Pure, so the tick's assembly is unit-tested from fixtures.
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
}

const PET_LOW = 30;

const n = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** The digest's lines in display order; empty when there is nothing to say. */
export function digestLines(d: DigestInput): string[] {
  const lines: string[] = [];
  if (d.yourTurn > 0) lines.push(d.yourTurn === 1 ? "🎲 your turn in a game" : `🎲 your turn in ${d.yourTurn} games`);
  if (d.invites > 0) lines.push(d.invites === 1 ? "🎮 a game invite is waiting" : `🎮 ${d.invites} game invites waiting`);
  if (d.unread > 0) lines.push(`💬 ${n(d.unread, "unread message")}`);
  if (d.dailyUnanswered) lines.push("💭 today's question is waiting");
  if (d.jarNotes > 0) lines.push(`🫙 ${n(d.jarNotes, "jar note")} to draw`);
  if (d.pet) {
    const needs = [d.pet.food < PET_LOW ? "food" : null, d.pet.joy < PET_LOW ? "a play" : null].filter((x): x is string => x !== null);
    if (needs.length) lines.push(`🐾 ${d.pet.name} needs ${needs.join(" and ")}`);
  }
  if (d.capsulesToday > 0) lines.push(d.capsulesToday === 1 ? "⏳ a time capsule unlocks today" : `⏳ ${d.capsulesToday} time capsules unlock today`);
  for (const title of d.milestonesToday) lines.push(`🎉 ${title} is today`);
  return lines;
}

/** Title + body for the push, or null when there is nothing to send. */
export function digestPush(nickname: string, d: DigestInput): { title: string; body: string } | null {
  const lines = digestLines(d);
  if (lines.length === 0) return null;
  return { title: `☀️ Good morning, ${nickname}`, body: lines.join(" · ").slice(0, 180) };
}
