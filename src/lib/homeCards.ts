/**
 * Home layout (phase 27): the one list of Home cards, the default order, and
 * how a saved preference plus the pinned-to-top rule become today's order.
 * Pure, so `pnpm test` covers it. Storage: `users/{uid}.homeCards`.
 */
import type { HomeCardsPref } from "@/lib/types";

export const HOME_CARDS = [
  { id: "presence", label: "Friend, time & notes", emoji: "👋" },
  { id: "snap", label: "Daily snap", emoji: "📸" },
  { id: "chatPreview", label: "Latest message", emoji: "💬" },
  { id: "games", label: "Game invites & your move", emoji: "🎲" },
  { id: "pings", label: "Pings", emoji: "🤗" },
  { id: "lamp", label: "Lamps", emoji: "💡" },
  { id: "dailyQuestion", label: "Daily question", emoji: "💭" },
  { id: "mood", label: "Mood check-in", emoji: "😊" },
  { id: "onThisDay", label: "On this day", emoji: "📆" },
  { id: "streakPlant", label: "Streak & plant", emoji: "🌱" },
  { id: "pet", label: "Pet", emoji: "🐾" },
  { id: "countdown", label: "Meetup countdown", emoji: "✈️" },
  { id: "nextUp", label: "Next milestone", emoji: "🎉" },
] as const;

export type HomeCardId = (typeof HOME_CARDS)[number]["id"];

export const DEFAULT_HOME_ORDER: readonly HomeCardId[] = HOME_CARDS.map((c) => c.id);

const KNOWN = new Set<string>(DEFAULT_HOME_ORDER);
export const isHomeCardId = (v: unknown): v is HomeCardId => typeof v === "string" && KNOWN.has(v);

/**
 * A stored preference made whole: unknown ids dropped, duplicates removed,
 * every card this build knows but the preference doesn't appended in default
 * order (so a new card appears without anyone touching the layout).
 */
export function normalizeHomeCards(pref: HomeCardsPref | null | undefined): { order: HomeCardId[]; hidden: HomeCardId[] } {
  const seen = new Set<HomeCardId>();
  const order: HomeCardId[] = [];
  for (const id of pref?.order ?? []) {
    if (isHomeCardId(id) && !seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  }
  for (const id of DEFAULT_HOME_ORDER) if (!seen.has(id)) order.push(id);
  const hidden = Array.from(new Set((pref?.hidden ?? []).filter(isHomeCardId)));
  return { order, hidden };
}

/** Cards that jump to the top regardless of the layout: snap time (first), then a game waiting on my move. */
export interface HomePins {
  snap: boolean;
  games: boolean;
}

/**
 * The cards Home renders, top to bottom: pinned cards first (a hidden card
 * still shows while pinned: the pin wins), then the saved order minus the
 * hidden ones.
 */
export function homeCardOrder(pref: HomeCardsPref | null | undefined, pins: HomePins): HomeCardId[] {
  const { order, hidden } = normalizeHomeCards(pref);
  const pinned: HomeCardId[] = [];
  if (pins.snap) pinned.push("snap");
  if (pins.games) pinned.push("games");
  const hiddenSet = new Set(hidden);
  return [...pinned, ...order.filter((id) => !pinned.includes(id) && !hiddenSet.has(id))];
}

/** A preference with `id` moved to `toIndex` (clamped). */
export function moveHomeCard(pref: HomeCardsPref | null | undefined, id: HomeCardId, toIndex: number): HomeCardsPref {
  const { order, hidden } = normalizeHomeCards(pref);
  const from = order.indexOf(id);
  if (from === -1) return { order, hidden };
  const next = order.filter((x) => x !== id);
  next.splice(Math.max(0, Math.min(next.length, toIndex)), 0, id);
  return { order: next, hidden };
}

/** A preference with `id` hidden or shown. */
export function setHomeCardHidden(pref: HomeCardsPref | null | undefined, id: HomeCardId, hide: boolean): HomeCardsPref {
  const { order, hidden } = normalizeHomeCards(pref);
  const set = new Set(hidden);
  if (hide) set.add(id);
  else set.delete(id);
  return { order, hidden: Array.from(set) };
}

/** True when the stored preference changes nothing (so More can show "Default"). */
export function isDefaultHomeLayout(pref: HomeCardsPref | null | undefined): boolean {
  const { order, hidden } = normalizeHomeCards(pref);
  return hidden.length === 0 && order.every((id, i) => id === DEFAULT_HOME_ORDER[i]);
}
