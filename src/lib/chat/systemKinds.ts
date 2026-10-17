/**
 * System lines in the chat: the stored shape and how a line is read back.
 * Pure (no Firebase), so the server (`postSystemMessageAdmin`), the client
 * writer (`createSystemMessage`) and the renderer share one definition.
 */

export const SYSTEM_KINDS = [
  "sleep",
  "wake",
  "relationship",
  "game-result",
  "game-cancel",
  "twenty-result",
  "pet-adopt",
  "pet-fed",
  "pet-level",
  "pet-hungry",
  "garden-sticker",
  "capsule-unlock",
  "hangout",
] as const;
export type SystemKind = (typeof SYSTEM_KINDS)[number];

/** Small, flat facts a line can be rebuilt from if its text is ever missing (≤ 8 keys, rule-checked). */
export type SystemMeta = Record<string, string | number>;

const SYSTEM_TEXT_MAX = 2000;
const FALLBACK = "✨";

/** The document every system line is written as. `createdAt` is the caller's server timestamp. */
export function systemMessageData<T>(senderId: string, kind: SystemKind, text: string, meta: SystemMeta | undefined, createdAt: T) {
  return {
    senderId,
    type: "system" as const,
    kind,
    text: text.slice(0, SYSTEM_TEXT_MAX),
    ...(meta ? { meta } : {}),
    status: "sent" as const,
    reactions: {},
    deletedFor: [] as string[],
    deletedForEveryone: false,
    createdAt,
  };
}

const str = (meta: SystemMeta | undefined, key: string): string | null => {
  const v = meta?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null;
};

/** A line rebuilt from kind + meta, for system messages stored without text. */
function systemText(kind: unknown, meta?: SystemMeta | null): string {
  const m = meta ?? undefined;
  const who = str(m, "who") ?? "Someone";
  const pet = str(m, "pet") ?? "your pet";
  switch (kind) {
    case "sleep":
      return `🌙 ${who} went to sleep`;
    case "wake":
      return `☀️ ${who} is up and about`;
    case "relationship":
      return `💞 ${who} changed what you are to each other`;
    case "game-result":
      return `🏁 A ${str(m, "game") ?? "game"} finished`;
    case "game-cancel":
      return `✕ A ${str(m, "game") ?? "game"} was cancelled`;
    case "twenty-result":
      return "🔍 20 Questions is over";
    case "pet-adopt":
      return `🐾 You adopted ${pet}!`;
    case "pet-fed":
      return `🍪 ${who} fed ${pet}`;
    case "pet-level":
      return `🎉 ${pet} reached level ${str(m, "level") ?? "up"}!`;
    case "pet-hungry":
      return `🍽️ ${pet} is getting hungry`;
    case "garden-sticker":
      return "🌼 You two unlocked a garden sticker!";
    case "capsule-unlock":
      return "⏳ A time capsule unlocked";
    case "hangout":
      return "🎡 Let's hang out!";
    default:
      return FALLBACK;
  }
}

interface SystemLike {
  text?: unknown;
  kind?: unknown;
  meta?: unknown;
}

/** What a system line shows: its text, else a line from kind + meta, else ✨. Never empty. */
export function systemLine(m: SystemLike): string {
  if (typeof m.text === "string" && m.text.trim()) return m.text.trim();
  const meta = m.meta && typeof m.meta === "object" && !Array.isArray(m.meta) ? (m.meta as SystemMeta) : null;
  return systemText(m.kind, meta);
}
