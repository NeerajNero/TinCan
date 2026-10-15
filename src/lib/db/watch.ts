/** Watch/listen together at watch/main and listen/main, plus the listen queue. */
import { onValue, push, ref, remove, runTransaction, serverTimestamp, set, update } from "firebase/database";

import { getRtdb } from "@/lib/firebase/client";

export interface PlayerNode {
  videoId: string | null;
  title: string;
  thumb?: string;
  playing: boolean;
  positionSec: number;
  /** Server epoch ms of the last write. */
  updatedAt: number;
  by: string;
}
export interface QueueItem {
  videoId: string;
  title: string;
  thumb: string;
  addedBy: string;
}

const r = (p: string) => ref(getRtdb(), p);

export function subscribePlayer(kind: "watch" | "listen", cb: (n: PlayerNode | null) => void): () => void {
  return onValue(r(`${kind}/main`), (s) => cb(s.exists() ? (s.val() as PlayerNode) : null));
}

export function writePlayer(kind: "watch" | "listen", patch: Partial<PlayerNode>): Promise<void> {
  return update(r(`${kind}/main`), { ...patch, updatedAt: serverTimestamp() });
}

export function loadVideo(kind: "watch" | "listen", by: string, videoId: string, title: string, thumb: string): Promise<void> {
  return set(r(`${kind}/main`), { videoId, title, thumb, playing: false, positionSec: 0, updatedAt: serverTimestamp(), by });
}

/* ── listen queue ──────────────────────────────────────────────────────── */

export function subscribeQueue(cb: (items: Array<QueueItem & { id: string }>) => void): () => void {
  return onValue(r("listen/queue"), (snap) => {
    const list: Array<QueueItem & { id: string }> = [];
    snap.forEach((c) => {
      list.push({ id: c.key as string, ...(c.val() as QueueItem) });
    });
    cb(list);
  });
}

export const enqueue = (item: QueueItem) => set(push(r("listen/queue")), item);
export const dequeue = (id: string) => remove(r(`listen/queue/${id}`));

/**
 * When the current track ends, advance exactly once: the transaction only
 * commits if `main.videoId` is still the one that ended.
 */
export async function advanceQueue(endedVideoId: string, by: string): Promise<boolean> {
  const res = await runTransaction(r("listen"), (cur: { main?: PlayerNode; queue?: Record<string, QueueItem> } | null) => {
    if (!cur?.main || cur.main.videoId !== endedVideoId) return;
    const entries = Object.entries(cur.queue ?? {}).sort(([a], [b]) => a.localeCompare(b));
    if (entries.length === 0) return { ...cur, main: { ...cur.main, playing: false, positionSec: 0, updatedAt: Date.now(), by } };
    const [id, next] = entries[0];
    const queue = { ...(cur.queue ?? {}) } as Record<string, QueueItem | null>;
    queue[id] = null;
    return { ...cur, queue, main: { videoId: next.videoId, title: next.title, thumb: next.thumb, playing: true, positionSec: 0, updatedAt: Date.now(), by } };
  });
  return res.committed;
}
