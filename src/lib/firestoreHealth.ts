/**
 * Counts how often Firestore drops to "offline" during this session, for
 * More → Diagnostics. A doc snapshot that arrives `fromCache` after one that
 * came from the server means the SDK lost its backend connection; each such
 * transition is one "went offline". The first snapshot (served from the
 * persistent cache before the backend answers) is not counted.
 *
 * Pure reducer here so it is unit-testable; `PairProvider` feeds it every
 * `pair/main` snapshot (that listener already runs with metadata changes for
 * the whole session), so this costs no extra listener or reads.
 */
import type { DocumentSnapshot } from "firebase/firestore";

export interface FirestoreHealth {
  /** null until the first snapshot arrived. */
  online: boolean | null;
  /** Server → cache transitions this session. */
  offlineCount: number;
  lastOfflineAt: number | null;
  lastOnlineAt: number | null;
  /** Milliseconds spent offline in finished outages (an ongoing one is excluded). */
  offlineMs: number;
}

export const initialHealth = (): FirestoreHealth => ({ online: null, offlineCount: 0, lastOfflineAt: null, lastOnlineAt: null, offlineMs: 0 });

/** Fold one snapshot's `fromCache` flag into the health state. */
export function reduceHealth(h: FirestoreHealth, fromCache: boolean, at: number): FirestoreHealth {
  const online = !fromCache;
  if (h.online === online) return h;
  if (online) {
    // The initial cached snapshot (online === null) ends no outage.
    const offlineMs = h.online === false && h.lastOfflineAt !== null ? h.offlineMs + Math.max(0, at - h.lastOfflineAt) : h.offlineMs;
    return { ...h, online, lastOnlineAt: at, offlineMs };
  }
  if (h.online === null) return { ...h, online };
  return { ...h, online, offlineCount: h.offlineCount + 1, lastOfflineAt: at };
}

let health = initialHealth();
const listeners = new Set<() => void>();

export const getFirestoreHealth = (): FirestoreHealth => health;

export function subscribeFirestoreHealth(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Called by PairProvider for every `pair/main` snapshot (metadata changes included). */
export function recordFirestoreSnapshot(snap: Pick<DocumentSnapshot, "metadata">): void {
  const next = reduceHealth(health, snap.metadata.fromCache, Date.now());
  if (next === health) return;
  health = next;
  listeners.forEach((l) => l());
}
