/**
 * View-once media (phase 27), the pure parts: the `?once=1` URL marker the
 * service worker refuses to cache, the bubble's state machine and the small
 * localStorage list of opens whose server delete still has to be retried.
 */
import { readPref, writePref } from "@/lib/localPref";
import type { MediaVariants, Message } from "@/lib/types";

export const ONCE_PARAM = "once";

/** `url` with `once=1` appended (Cloudinary ignores unknown query params on signed URLs; verified against the live cloud). */
export function onceUrl(url: string): string {
  if (/[?&]once=1(&|$)/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${ONCE_PARAM}=1`;
}

export function onceVariants(variants: MediaVariants | undefined): MediaVariants | undefined {
  if (!variants) return variants;
  const out: MediaVariants = {};
  for (const [k, v] of Object.entries(variants)) if (typeof v === "string") out[k as keyof MediaVariants] = onceUrl(v);
  return out;
}

/** The worker asks this for every request: never cache a view-once asset. */
export function isOnceRequest(url: URL): boolean {
  return url.searchParams.get(ONCE_PARAM) === "1";
}

/**
 * - plain: not a view-once message
 * - sealed-theirs: the recipient hasn't opened it yet (tap to view once)
 * - sealed-mine: I sent it and they haven't opened it
 * - opened: viewed (or the asset already cleared); both sides see "Opened"
 */
export type ViewOnceState = "plain" | "sealed-theirs" | "sealed-mine" | "opened";

export function viewOnceState(m: Pick<Message, "viewOnce" | "viewedAt" | "media" | "senderId">, uid: string): ViewOnceState {
  if (m.viewOnce !== true) return "plain";
  if (m.viewedAt || !m.media) return "opened";
  return m.senderId === uid ? "sealed-mine" : "sealed-theirs";
}

/** The sealed label the bubble shows. */
export function viewOnceLabel(type: Message["type"], state: ViewOnceState, openedAt: string | null): string {
  const thing = type === "voice" ? "Voice note" : "Photo";
  switch (state) {
    case "sealed-theirs":
      return `👁️ ${thing} · tap to ${type === "voice" ? "play" : "view"} once`;
    case "sealed-mine":
      return "👁️ View once · not opened yet";
    case "opened":
      return openedAt ? `👁️ Opened at ${openedAt}` : "👁️ Opened";
    default:
      return "";
  }
}

/* ── pending deletes (retry on the next app open) ──────────────────────── */

const PENDING_KEY = "tincan:viewonce-pending";

export function readPendingViewOnce(): string[] {
  try {
    const list = JSON.parse(readPref(PENDING_KEY) ?? "[]") as unknown;
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function addPendingViewOnce(id: string): void {
  const list = readPendingViewOnce();
  if (!list.includes(id)) writePref(PENDING_KEY, JSON.stringify([...list, id].slice(-50)));
}

export function removePendingViewOnce(id: string): void {
  writePref(PENDING_KEY, JSON.stringify(readPendingViewOnce().filter((x) => x !== id)));
}
