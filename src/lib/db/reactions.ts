import { getRtdb } from "@/lib/firebase/client";
import { push, ref, remove, serverTimestamp, set } from "@/lib/firebase/rt";
import { REACTION_TTL_MS } from "@/lib/reactions";
import { swallow } from "@/lib/swallow";

export const gameReactionsPath = (gameId: string) => `gameReactions/${gameId}`;

/**
 * Queues one reaction for both phones and removes it again after
 * REACTION_TTL_MS, so the node holds only what is in flight. Resolves with the
 * push id once the write is acknowledged.
 */
export async function sendGameReaction(gameId: string, by: string, emoji: string): Promise<string> {
  const node = push(ref(getRtdb(), gameReactionsPath(gameId)));
  await set(node, { by, emoji, at: serverTimestamp() });
  setTimeout(() => {
    remove(node).catch(swallow);
  }, REACTION_TTL_MS);
  return node.key ?? "";
}
