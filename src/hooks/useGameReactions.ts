"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { gameReactionsPath, sendGameReaction } from "@/lib/db/reactions";
import { firebaseErrorCode, isPermissionDenied } from "@/lib/diagLog";
import { limitToLast, onValue, query, remove } from "@/lib/firebase/rt";
import { admitReaction, ingestExisting, REACTION_LIFE_MS, REACTION_MAX_LIVE, tapAllowed, type LiveReaction } from "@/lib/reactions";
import { rtdbRef } from "@/lib/rtdb";
import { swallow } from "@/lib/swallow";

/** After a transport cancel (never a rules denial) the listener is re-attached with this backoff. */
const RETRY_MS = [2000, 5000, 15000, 30000];

/**
 * The reaction feed for one game, from exactly one subscription: a `value`
 * listener on the last 12 children. The first snapshot is whatever was there
 * when the screen opened: remembered (never animated) and deleted. Every key
 * that appears in a later snapshot animates once, whatever its timestamp; the
 * sender's own tap arrives through this same path (its optimistic event and
 * the server echo share the key). No separate `get()`: a dropped connection
 * only delays the first snapshot, it cannot fail the read, and the SDK re-sends
 * on reconnect.
 *
 * One listener, not a child_added + value pair: when the backend refuses a
 * query the SDK cancels *every* registration on it, so a pair received two
 * cancels, scheduled two retries, and doubled the number of listeners with
 * every wave (2, 4, 8, 16 denials in one millisecond). A cancel is handled
 * once per attachment. A rules denial (PERMISSION_DENIED) is final: the
 * wrapper logged it once, nothing re-attaches. Any other cancel (a transport
 * error) re-attaches with a backoff instead of staying dead.
 *
 * The feed is decided outside React's state updater (`liveRef`), which runs
 * later and, in StrictMode, twice: deciding inside it animated nothing.
 */
export function useGameReactions(gameId: string, uid: string): { live: LiveReaction[]; react: (emoji: string) => void } {
  const [live, setLive] = useState<LiveReaction[]>([]);
  const liveRef = useRef<LiveReaction[]>([]);
  const lastTap = useRef<number | null>(null);

  useEffect(() => {
    const seen = new Set<string>();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let cancelled = false;
    let detach: (() => void) | null = null;
    let attempt = 0;
    const path = rtdbRef(gameReactionsPath(gameId));
    const publish = (next: LiveReaction[]) => {
      liveRef.current = next;
      setLive(next);
    };

    const attach = () => {
      if (cancelled) return;
      let first = true;
      let settled = false; // this attachment was cancelled; the SDK may say so more than once
      const off = onValue(
        query(path, limitToLast(REACTION_MAX_LIVE)),
        (snap) => {
          const ids: string[] = [];
          const nodes = new Map<string, unknown>();
          snap.forEach((c) => {
            const id = c.key ?? "";
            ids.push(id);
            nodes.set(id, c.val());
          });
          if (first) {
            // The first snapshot: everything so far was there when the screen opened.
            first = false;
            attempt = 0;
            for (const id of ingestExisting(seen, ids)) remove(rtdbRef(`${gameReactionsPath(gameId)}/${id}`)).catch(swallow);
            return;
          }
          for (const id of ids) {
            const r = admitReaction(seen, liveRef.current, id, nodes.get(id), Date.now());
            if (!r.added) continue;
            publish(r.live);
            try {
              navigator.vibrate?.(20);
            } catch {
              // no haptics
            }
            const t = setTimeout(() => {
              timers.delete(t);
              publish(liveRef.current.filter((x) => x.id !== id));
            }, REACTION_LIFE_MS);
            timers.add(t);
          }
        },
        (err) => {
          if (settled || cancelled) return;
          settled = true;
          // The SDK has already dropped the registration; the wrapper logged the failure once.
          off();
          detach = null;
          if (isPermissionDenied(firebaseErrorCode(err))) return; // rules said no: retrying would only repeat the denial
          const wait = RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)] ?? 30000;
          attempt += 1;
          const t = setTimeout(() => {
            timers.delete(t);
            attach();
          }, wait);
          timers.add(t);
        },
      );
      detach = off;
    };
    attach();

    return () => {
      cancelled = true;
      detach?.();
      for (const t of timers) clearTimeout(t);
      publish([]);
    };
  }, [gameId]);

  const react = useCallback(
    (emoji: string) => {
      const now = Date.now();
      if (!tapAllowed(lastTap.current, now)) return;
      lastTap.current = now;
      sendGameReaction(gameId, uid, emoji).catch(swallow);
    },
    [gameId, uid],
  );

  return { live, react };
}
