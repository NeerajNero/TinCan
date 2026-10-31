"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { gameReactionsPath, sendGameReaction } from "@/lib/db/reactions";
import { limitToLast, onChildAdded, onValue, query, remove } from "@/lib/firebase/rt";
import { admitReaction, ingestExisting, REACTION_LIFE_MS, REACTION_MAX_LIVE, tapAllowed, type LiveReaction } from "@/lib/reactions";
import { rtdbRef } from "@/lib/rtdb";
import { swallow } from "@/lib/swallow";

/** After a cancelled subscription (a refused read, a transport error) the listeners are re-attached with this backoff. */
const RETRY_MS = [2000, 5000, 15000, 30000];

/**
 * The reaction feed for one game, from one subscription: `child_added` on the
 * last 12 children plus a `value` listener on the same query. The SDK raises
 * child_added for everything already there *before* the first value event, so
 * those keys are the first snapshot: remembered (never animated) and deleted.
 * Every child_added after that first value event animates once, whatever its
 * timestamp; the sender's own tap arrives through this same path (its
 * optimistic event and the server echo share the key). No separate `get()`:
 * a dropped connection only delays the first value event, it cannot fail the
 * read, and the SDK re-sends the data on reconnect. If the subscription is
 * cancelled anyway, the hook re-attaches with a backoff instead of staying dead.
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
      const q = query(path, limitToLast(REACTION_MAX_LIVE));
      let initial: string[] | null = []; // keys delivered before the first value event
      const onCancel = () => {
        // Logged by the wrapper. Drop this subscription and try again later; a later success starts from a fresh first snapshot.
        detach?.();
        detach = null;
        const wait = RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)] ?? 30000;
        attempt += 1;
        const t = setTimeout(() => {
          timers.delete(t);
          attach();
        }, wait);
        timers.add(t);
      };
      const offAdded = onChildAdded(
        q,
        (c) => {
          const id = c.key ?? "";
          if (initial) {
            initial.push(id);
            return;
          }
          const r = admitReaction(seen, liveRef.current, id, c.val(), Date.now());
          if (!r.added) return;
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
        },
        onCancel,
      );
      const offValue = onValue(
        q,
        () => {
          if (!initial) return;
          // The first snapshot: everything so far was there when the screen opened.
          for (const id of ingestExisting(seen, initial)) remove(rtdbRef(`${gameReactionsPath(gameId)}/${id}`)).catch(swallow);
          initial = null;
          attempt = 0;
        },
        onCancel,
      );
      detach = () => {
        offAdded();
        offValue();
      };
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
