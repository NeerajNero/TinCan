/**
 * The shared garden: each kind of "together" moment unlocks one sticker on
 * pair/main.garden.stickers, exactly once. Writes are transactional so two
 * clients firing the same event still produce a single unlock; the toast
 * comes from the live layer watching the pair doc, so both people see it.
 */
import { runTransaction, serverTimestamp } from "@/lib/firebase/fs";

import { STICKER_BY_ID, type GardenEvent } from "@/content/garden";
import { postSystemMessage } from "@/lib/db/home";
import { pairRef } from "@/lib/db/refs";
import { getDb } from "@/lib/firebase/client";
import type { PairDoc } from "@/lib/types";

export type { GardenEvent };
export type TogetherEvent = GardenEvent;

/** Unlock the sticker for `kind` if it isn't already; returns true on a fresh unlock. */
export async function recordTogetherEvent(kind: GardenEvent, by: string): Promise<boolean> {
  const sticker = STICKER_BY_ID[kind];
  if (!sticker) return false;
  let unlocked = false;
  try {
    await runTransaction(getDb(), async (tx) => {
      const snap = await tx.get(pairRef());
      const pair = snap.data() as PairDoc | undefined;
      if (!pair || pair.garden?.stickers?.[kind]) return;
      unlocked = true;
      tx.update(pairRef(), { [`garden.stickers.${kind}`]: { at: serverTimestamp(), by } });
    });
  } catch {
    return false;
  }
  if (unlocked) void postSystemMessage(by, `${sticker.emoji} You two unlocked the ${sticker.name}!`);
  return unlocked;
}
