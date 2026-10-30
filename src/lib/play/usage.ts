/**
 * Shared Play usage on `pair/main.play`: what the two of you opened last and
 * what you pinned. Pure reducers; `lib/db/play.ts` writes the results.
 * `at` is client ms (serverTimestamp() can't live inside an array), used only
 * for ordering and the write throttle.
 */
export const PLAY_RECENT_MAX = 8;
export const PLAY_RECENT_SHOWN = 4;
export const PLAY_FAVOURITES_MAX = 6;
/** One `recent` write per game per ten minutes, whoever opened it. */
export const PLAY_RECENT_THROTTLE_MS = 10 * 60_000;

export interface PlayRecent {
  id: string;
  at: number;
  by: string;
}

export interface PlayUsage {
  recent?: PlayRecent[];
  favourites?: string[];
}

const isRecent = (r: unknown): r is PlayRecent => typeof r === "object" && r !== null && typeof (r as PlayRecent).id === "string" && typeof (r as PlayRecent).at === "number";

/** Valid, de-duplicated rows, newest first, in storage order. */
export function recentOf(usage: PlayUsage | null | undefined): PlayRecent[] {
  const seen = new Set<string>();
  const out: PlayRecent[] = [];
  for (const r of usage?.recent ?? []) {
    if (!isRecent(r) || seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

export function favouritesOf(usage: PlayUsage | null | undefined): string[] {
  return Array.from(new Set((usage?.favourites ?? []).filter((id): id is string => typeof id === "string")));
}

/**
 * The `recent` list after opening `id` now, or null when nothing should be
 * written: the same game was already recorded less than ten minutes ago.
 */
export function recordRecent(usage: PlayUsage | null | undefined, id: string, by: string, now: number): PlayRecent[] | null {
  const current = recentOf(usage);
  const existing = current.find((r) => r.id === id);
  if (existing && now - existing.at < PLAY_RECENT_THROTTLE_MS) return null;
  return [{ id, at: now, by }, ...current.filter((r) => r.id !== id)].slice(0, PLAY_RECENT_MAX);
}

/** The `favourites` list with `id` pinned or unpinned, or null when pinning would exceed the cap. */
export function toggleFavourite(usage: PlayUsage | null | undefined, id: string, on: boolean): string[] | null {
  const current = favouritesOf(usage);
  if (!on) return current.filter((f) => f !== id);
  if (current.includes(id)) return current;
  if (current.length >= PLAY_FAVOURITES_MAX) return null;
  return [...current, id];
}

/**
 * Whether a catalogue section starts expanded: the device's remembered choice
 * ("1" / "0") wins; otherwise everything is collapsed once Recent has entries
 * and expanded on a fresh install.
 */
export function sectionOpen(pref: string | null, hasRecent: boolean): boolean {
  if (pref === "1") return true;
  if (pref === "0") return false;
  return !hasRecent;
}

export const sectionPrefKey = (section: string): string => `tincan:play-open:${section}`;
