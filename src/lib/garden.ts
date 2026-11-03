/**
 * The shared garden: each kind of "together" moment unlocks one sticker on
 * pair/main.garden.stickers, exactly once. Writes are transactional so two
 * clients firing the same event still produce a single unlock; the toast
 * comes from the live layer watching the pair doc, so both people see it.
 */

import { STICKER_BY_ID, type GardenEvent } from "@/content/garden";
import { createSystemMessage } from "@/lib/chat/system";
import { currentPair } from "@/lib/db/pairCache";
import { pairRef } from "@/lib/db/refs";
import { getDb } from "@/lib/firebase/client";
import { runTransaction, serverTimestamp } from "@/lib/firebase/fs";
import { swallow } from "@/lib/swallow";
import type { PairDoc } from "@/lib/types";

export type { GardenEvent };

/** Unlock the sticker for `kind` if it isn't already; returns true on a fresh unlock. */
export async function recordTogetherEvent(kind: GardenEvent, by: string): Promise<boolean> {
  const sticker = STICKER_BY_ID[kind];
  if (!sticker) return false;
  // Already unlocked by the pair doc this phone holds → no transaction at all (a read-only pass would still
  // commit a verify on pair/main and contend with whatever else writes it, e.g. the records bump at a game's end).
  if (currentPair()?.garden?.stickers?.[kind]) return false;
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
  if (unlocked) createSystemMessage("garden-sticker", `${sticker.emoji} You two unlocked the ${sticker.name}!`, { sticker: kind }).catch(swallow);
  return unlocked;
}
