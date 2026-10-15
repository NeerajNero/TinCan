"use client";

import { onValue } from "firebase/database";
import { useEffect, useState } from "react";

import { pingsPath, rtdbRef } from "@/lib/rtdb";
import type { PingKind, PingNode } from "@/lib/types";

export interface IncomingPing extends PingNode {
  /** Changes on every new ping so the overlay re-triggers even for the same kind. */
  nonce: number;
}

const KINDS: readonly string[] = ["thinking", "hug", "highfive", "wave"];

/**
 * Watches `pings/{me}`. The snapshot already there when we mount is history and
 * is ignored; every later change is a fresh ping, which also buzzes the phone.
 */
export function useIncomingPings(uid: string): IncomingPing | null {
  const [ping, setPing] = useState<IncomingPing | null>(null);

  useEffect(() => {
    const mountedAt = Date.now();
    let first = true;
    const unsubscribe = onValue(rtdbRef(pingsPath(uid)), (snap) => {
      if (first) {
        first = false;
        return;
      }
      const val = snap.val() as Partial<PingNode> | null;
      if (!val || typeof val.at !== "number" || !val.from || !KINDS.includes(val.kind ?? "")) return;
      // Guard against a stale replay after a reconnect (allowing some clock skew).
      if (val.at < mountedAt - 5 * 60_000) return;
      setPing({ from: val.from, kind: val.kind as PingKind, at: val.at, nonce: Date.now() });
      try {
        navigator.vibrate?.([100, 50, 100]);
      } catch {
        // No haptics here.
      }
    });
    return () => {
      unsubscribe();
      setPing(null);
    };
  }, [uid]);

  return ping;
}
