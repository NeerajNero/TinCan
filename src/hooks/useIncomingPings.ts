"use client";

import { useEffect, useState } from "react";

import { get, limitToLast, onChildAdded, query, remove } from "@/lib/firebase/rt";
import { pingsPath, rtdbRef } from "@/lib/rtdb";
import type { PingKind, PingNode } from "@/lib/types";

export interface IncomingPing extends PingNode {
  /** The push id, so identical kinds in a row still re-trigger the overlay. */
  nonce: string;
}

const KINDS: readonly string[] = ["thinking", "hug", "highfive", "wave", "kiss"];
const FRESH_MS = 2 * 60_000;

/**
 * Watches the ping queue at pings/{me}. Children under two minutes old are
 * handed out one at a time; anything older on open is summarised through
 * `onMissed`. Every child is deleted once it has been shown.
 */
export function useIncomingPings(uid: string, onMissed?: (kinds: PingKind[]) => void): IncomingPing | null {
  const [ping, setPing] = useState<IncomingPing | null>(null);

  useEffect(() => {
    const q = query(rtdbRef(pingsPath(uid)), limitToLast(10));
    const seen = new Set<string>();
    let cancelled = false;

    const valid = (v: Partial<PingNode> | null): v is PingNode => Boolean(v && typeof v.at === "number" && v.from && KINDS.includes(v.kind ?? ""));

    const show = (key: string, v: PingNode) => {
      setPing({ ...v, nonce: key });
      try {
        navigator.vibrate?.([100, 50, 100]);
      } catch {
        // no haptics
      }
    };

    let unsub: (() => void) | null = null;
    void get(q).then((snap) => {
      if (cancelled) return;
      const missed: PingKind[] = [];
      const now = Date.now();
      snap.forEach((c) => {
        const key = c.key as string;
        seen.add(key);
        const v = c.val() as Partial<PingNode> | null;
        if (valid(v) && now - v.at < FRESH_MS) show(key, v);
        else if (valid(v)) missed.push(v.kind);
        void remove(c.ref);
      });
      if (missed.length) onMissed?.(missed);
      unsub = onChildAdded(q, (c) => {
        const key = c.key as string;
        if (seen.has(key)) return;
        seen.add(key);
        const v = c.val() as Partial<PingNode> | null;
        if (valid(v) && Date.now() - v.at < FRESH_MS) show(key, v);
        void remove(c.ref);
      });
    });

    return () => {
      cancelled = true;
      unsub?.();
      setPing(null);
    };
    // onMissed is read once at mount by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  return ping;
}
