/**
 * The latest `pair/main` the PairProvider listener delivered, for libs with no
 * React context that want to skip a transaction the document already rules out
 * (a sticker already unlocked, say). A read-only transaction still commits a
 * `verify` on what it read, so skipping it removes real contention on the doc.
 */
import type { PairDoc } from "@/lib/types";

let current: PairDoc | null = null;

export const rememberPair = (pair: PairDoc | null): void => {
  current = pair;
};
export const currentPair = (): PairDoc | null => current;
