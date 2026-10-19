"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import { get, onValue } from "@/lib/firebase/rt";
import {
  armPresenceOnDisconnect,
  presenceHeartbeat,
  presenceOffline,
  presenceOnline,
  presencePage,
  presenceStatus,
  rtdbRef,
  presencePath,
} from "@/lib/rtdb";
import type { PresenceStatus } from "@/lib/types";

const HEARTBEAT_MS = 60_000;

/* ── my awake/sleeping status, a tiny external store so Home can read it ── */

let myStatus: PresenceStatus = "awake";
const listeners = new Set<() => void>();
const notifyStatus = () => listeners.forEach((l) => l());
const subscribeStatus = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getStatus = () => myStatus;
const getServerStatus = (): PresenceStatus => "awake";

export function useMyStatus(): PresenceStatus {
  return useSyncExternalStore(subscribeStatus, getStatus, getServerStatus);
}

/** Persist a new status and tell subscribers. */
export async function setMyStatus(uid: string, status: PresenceStatus): Promise<void> {
  myStatus = status;
  notifyStatus();
  await presenceStatus(uid, status);
}

/** Called before signing out so the friend sees us go offline immediately. */
export async function markOffline(uid: string): Promise<void> {
  try {
    await presenceOffline(uid);
  } catch {
    // Already disconnected or signed out — onDisconnect will take care of it.
  }
}

const swallow = () => undefined;

/**
 * Mount once, inside the auth gate. Keeps `presence/{uid}` honest: online on
 * connect (with an onDisconnect fallback), a 60-second heartbeat while visible,
 * offline when the tab is hidden, and the current page on every route change.
 */
export function usePresence(uid: string | null, page: string): void {
  const pageRef = useRef(page);

  // Connection lifecycle: online + onDisconnect + heartbeat + visibility.
  useEffect(() => {
    if (!uid) return;
    let connected = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;

    const visible = () => document.visibilityState === "visible";

    const startHeartbeat = () => {
      if (heartbeat) return;
      heartbeat = setInterval(() => {
        if (connected && visible()) presenceHeartbeat(uid).catch(swallow);
      }, HEARTBEAT_MS);
    };
    const stopHeartbeat = () => {
      if (heartbeat) clearInterval(heartbeat);
      heartbeat = null;
    };

    const goOnline = () => {
      armPresenceOnDisconnect(uid).catch(swallow);
      presenceOnline(uid, pageRef.current).catch(swallow);
      startHeartbeat();
    };

    const stopConnected = onValue(rtdbRef(".info/connected"), (snap) => {
      connected = snap.val() === true;
      if (connected && visible()) goOnline();
    });

    // Restore the sleeping/awake status I last set (one read, no listener).
    get(rtdbRef(`${presencePath(uid)}/status`))
      .then((snap) => {
        const stored = snap.val();
        if (stored === "awake" || stored === "sleeping") {
          myStatus = stored;
        } else {
          myStatus = "awake";
          presenceStatus(uid, "awake").catch(swallow);
        }
        notifyStatus();
      })
      .catch(swallow);

    const onVisibility = () => {
      if (!connected) return;
      if (visible()) goOnline();
      else {
        stopHeartbeat();
        presenceOffline(uid).catch(swallow);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stopConnected();
      stopHeartbeat();
      if (connected) presenceOffline(uid).catch(swallow);
    };
  }, [uid]);

  // Which screen I'm on — a tiny write per route change, and remembered for reconnects.
  useEffect(() => {
    pageRef.current = page;
    if (!uid) return;
    presencePage(uid, page).catch(swallow);
  }, [uid, page]);
}
