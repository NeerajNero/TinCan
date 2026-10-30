import { pairRef } from "@/lib/db/refs";
import { updateDoc } from "@/lib/firebase/fs";
import { PLAY_RECENT_THROTTLE_MS, recordRecent, toggleFavourite, type PlayUsage } from "@/lib/play/usage";

/** When this device last recorded each id, so two quick opens can't race the snapshot into two writes. */
const trackedAt = new Map<string, number>();

/** Prepends `id` to the shared recent list (de-duplicated, one write per game per ten minutes). */
export async function trackPlayOpen(usage: PlayUsage | undefined, id: string, uid: string, now: number = Date.now()): Promise<void> {
  const local = trackedAt.get(id);
  if (local !== undefined && now - local < PLAY_RECENT_THROTTLE_MS) return;
  const next = recordRecent(usage, id, uid, now);
  if (!next) return;
  trackedAt.set(id, now);
  await updateDoc(pairRef(), { "play.recent": next });
}

/** Pins or unpins `id` for both of you. Resolves false when the six favourites are taken. */
export async function setPlayFavourite(usage: PlayUsage | undefined, id: string, on: boolean): Promise<boolean> {
  const next = toggleFavourite(usage, id, on);
  if (!next) return false;
  await updateDoc(pairRef(), { "play.favourites": next });
  return true;
}
