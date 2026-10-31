/**
 * Quick emoji reactions during a board game: a queue at RTDB
 * `gameReactions/{gameId}/{pushId}`, like pings. Pure parts: which emoji
 * exist, the per-phone feed (each push id animated once, whatever existed at
 * mount ignored, at most 12 live, each gone after its animation), the tap gap
 * and the node's lifetime. `hooks/useGameReactions` wires it to RTDB.
 */
export const GAME_REACTIONS = ["👏", "😱", "🤔", "😂"] as const;
/** The sender deletes its node this long after writing it, so the queue never grows. */
export const REACTION_TTL_MS = 5000;
/** How long one floating emoji stays on screen. */
export const REACTION_LIFE_MS = 1800;
/** Live particles at once; the oldest are dropped first. */
export const REACTION_MAX_LIVE = 12;
/** Two taps closer than this count as one. */
export const REACTION_TAP_GAP_MS = 350;

export interface ReactionNode {
  by: string;
  emoji: string;
  at: number;
}

export interface LiveReaction extends ReactionNode {
  /** The RTDB push id: the one key a reaction is animated under. */
  id: string;
  /** 0–1 across the board, so copies of the same emoji don't stack. */
  lane: number;
  /** When this phone admitted it (ms). */
  shownAt: number;
}

export const isReactionNode = (v: unknown): v is ReactionNode => typeof v === "object" && v !== null && typeof (v as ReactionNode).by === "string" && typeof (v as ReactionNode).emoji === "string" && (v as ReactionNode).emoji.length > 0 && (v as ReactionNode).emoji.length <= 8 && typeof (v as ReactionNode).at === "number";

/** A stable spot per id (five lanes), so the same emoji twice floats from two places. */
export function laneFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 5) / 4;
}

/**
 * Children present when the screen opened: remembered so they never animate.
 * Returns their ids (the hook deletes them: they are leftovers by definition).
 */
export function ingestExisting(seen: Set<string>, ids: readonly string[]): string[] {
  for (const id of ids) seen.add(id);
  return [...ids];
}

/**
 * A child added after mount. Animated exactly once per push id (the sender's
 * optimistic event and the server echo share the id), never when it was there
 * at mount or has an unexpected shape. Returns the new live list and what was
 * added; `live` is capped at REACTION_MAX_LIVE, oldest dropped.
 */
export function admitReaction(seen: Set<string>, live: readonly LiveReaction[], id: string, node: unknown, now: number): { live: LiveReaction[]; added: LiveReaction | null } {
  if (seen.has(id) || !isReactionNode(node)) return { live: [...live], added: null };
  seen.add(id);
  const added: LiveReaction = { ...node, id, lane: laneFor(id), shownAt: now };
  const next = [...live.filter((r) => now - r.shownAt < REACTION_LIFE_MS), added];
  return { live: next.slice(Math.max(0, next.length - REACTION_MAX_LIVE)), added };
}

/** Drops reactions whose animation has finished. */
export function expireReactions(live: readonly LiveReaction[], now: number): LiveReaction[] {
  return live.filter((r) => now - r.shownAt < REACTION_LIFE_MS);
}

export function tapAllowed(lastTapAt: number | null, now: number): boolean {
  return lastTapAt === null || now - lastTapAt >= REACTION_TAP_GAP_MS;
}
