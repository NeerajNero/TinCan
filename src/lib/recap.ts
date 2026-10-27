/** The monthly recap line posted to chat on the 1st. Pure; the tick gathers the numbers. */

export interface RecapInput {
  /** "October" (the month that just ended). */
  monthLabel: string;
  /** The two uids in pair order. */
  uids: string[];
  names: Record<string, string>;
  messages: Record<string, number>;
  wins: Record<string, number>;
  draws: number;
  stickers: number;
  longestStreak: number;
  /** Ping kind with the most sends last month, or null. */
  favouritePing: string | null;
}

const PING_EMOJI: Record<string, string> = { thinking: "💭", hug: "🤗", highfive: "✋", wave: "👋", kiss: "😘" };

const fmt = (x: number) => x.toLocaleString("en-IN");

/** "📊 October: 1,204 messages (Neeraj 640 · Shravya 564) · games 7–5 · 3 stickers · longest streak 18 · favourite ping 🤗" */
export function recapLine(r: RecapInput): string {
  const total = r.uids.reduce((sum, u) => sum + (r.messages[u] ?? 0), 0);
  const per = r.uids.map((u) => `${r.names[u] ?? "?"} ${fmt(r.messages[u] ?? 0)}`).join(" · ");
  const parts = [`${fmt(total)} ${total === 1 ? "message" : "messages"}${total > 0 ? ` (${per})` : ""}`];
  const games = r.uids.reduce((sum, u) => sum + (r.wins[u] ?? 0), 0) + r.draws;
  if (games > 0) {
    const score = r.uids.map((u) => fmt(r.wins[u] ?? 0)).join("–");
    parts.push(`games ${score}${r.draws > 0 ? ` (${r.draws} ${r.draws === 1 ? "draw" : "draws"})` : ""}`);
  }
  if (r.stickers > 0) parts.push(`${r.stickers} ${r.stickers === 1 ? "sticker" : "stickers"}`);
  if (r.longestStreak > 0) parts.push(`longest streak ${r.longestStreak}`);
  if (r.favouritePing) parts.push(`favourite ping ${PING_EMOJI[r.favouritePing] ?? r.favouritePing}`);
  return `📊 ${r.monthLabel}: ${parts.join(" · ")}`;
}

/** The kind sent most since the last recap (counts now minus counts then); ties go to the first in `order`. */
export function favouritePing(now: Record<string, number> | undefined, then: Record<string, number> | undefined, order: readonly string[] = Object.keys(PING_EMOJI)): string | null {
  let best: string | null = null;
  let bestN = 0;
  const kinds = [...order, ...Object.keys(now ?? {}).filter((k) => !order.includes(k))];
  for (const k of kinds) {
    const delta = (now?.[k] ?? 0) - (then?.[k] ?? 0);
    if (delta > bestN) {
      best = k;
      bestN = delta;
    }
  }
  return best;
}
