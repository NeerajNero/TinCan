/**
 * Realtime Database paths and the small writes Home makes. Everything here is
 * ephemeral; nothing is read back except through `useRtdbValue`.
 */
import { getRtdb } from "@/lib/firebase/client";
import { onDisconnect, push, ref, serverTimestamp, set, update, type DatabaseReference } from "@/lib/firebase/rt";
import type { LampNode, PingKind, PresenceStatus } from "@/lib/types";

const LAMP_DURATION_MS = 10 * 60 * 1000;

export const presencePath = (uid: string) => `presence/${uid}`;
export const pingsPath = (uid: string) => `pings/${uid}`;
export const lampPath = (uid: string) => `lamp/${uid}`;

export function rtdbRef(path: string): DatabaseReference {
  return ref(getRtdb(), path);
}

/* ── presence ──────────────────────────────────────────────────────────── */

export function presenceOnline(uid: string, page: string): Promise<void> {
  return update(rtdbRef(presencePath(uid)), { online: true, lastSeen: serverTimestamp(), page });
}

export function presenceOffline(uid: string): Promise<void> {
  return update(rtdbRef(presencePath(uid)), { online: false, lastSeen: serverTimestamp() });
}

export function presenceHeartbeat(uid: string): Promise<void> {
  return update(rtdbRef(presencePath(uid)), { lastSeen: serverTimestamp() });
}

export function presencePage(uid: string, page: string): Promise<void> {
  return update(rtdbRef(presencePath(uid)), { page });
}

export function presenceStatus(uid: string, status: PresenceStatus): Promise<void> {
  return update(rtdbRef(presencePath(uid)), { status });
}

/** Server-side: when this connection drops, mark me offline. Re-arm after every reconnect. */
export function armPresenceOnDisconnect(uid: string): Promise<void> {
  return onDisconnect(rtdbRef(presencePath(uid))).update({ online: false, lastSeen: serverTimestamp() });
}

/* ── pings ─────────────────────────────────────────────────────────────── */

/** Queue a ping: one child per send, so a run of hugs animates one by one. */
export function sendPing(toUid: string, fromUid: string, kind: PingKind): Promise<void> {
  return set(push(rtdbRef(pingsPath(toUid))), { from: fromUid, kind, at: serverTimestamp() });
}

/* ── lamp ──────────────────────────────────────────────────────────────── */

/** Light the friend's lamp for ten minutes. */
export function lightLamp(toUid: string, color: string): Promise<void> {
  const node: LampNode = { on: true, color, until: Date.now() + LAMP_DURATION_MS };
  return set(rtdbRef(lampPath(toUid)), node);
}
