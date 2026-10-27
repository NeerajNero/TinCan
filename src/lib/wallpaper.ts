/**
 * The chat wallpaper is shared (pair/main.chatBg). Before phase 22b it lived on
 * users/{uid}.chatBg; this plans the one-time move for whoever opens first.
 */
import type { ChatBgPref } from "@/lib/types";

export interface WallpaperMigration {
  /** Set pair.chatBg to this (null = plain) — only when the pair has no value yet. */
  copyToPair: ChatBgPref | null | undefined;
  /** Remove the legacy users/{me}.chatBg field (the rules no longer accept it). */
  clearMine: boolean;
}

/**
 * `pairValue` is the pair doc's field (undefined = never set; null = plain),
 * `mine` the legacy per-user field. The first person whose old choice reaches a
 * pair without one copies it; everyone clears their own legacy field.
 */
export function planWallpaperMigration(pairValue: ChatBgPref | null | undefined, mine: ChatBgPref | null | undefined): WallpaperMigration {
  const hasLegacy = mine !== undefined;
  return { copyToPair: hasLegacy && pairValue === undefined ? mine : undefined, clearMine: hasLegacy };
}

/** Two prefs mean the same wallpaper. */
export function sameWallpaper(a: ChatBgPref | null | undefined, b: ChatBgPref | null | undefined): boolean {
  const key = (p: ChatBgPref | null | undefined) => (p ? `${p.id}:${p.photoPublicId ?? p.photoUrl ?? ""}` : "plain");
  return key(a) === key(b);
}
