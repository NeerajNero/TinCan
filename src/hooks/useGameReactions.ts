"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { gameReactionsPath, sendGameReaction } from "@/lib/db/reactions";
import { get, limitToLast, onChildAdded, query, remove } from "@/lib/firebase/rt";
import { admitReaction, ingestExisting, REACTION_LIFE_MS, REACTION_MAX_LIVE, tapAllowed, type LiveReaction } from "@/lib/reactions";
import { rtdbRef } from "@/lib/rtdb";
import { swallow } from "@/lib/swallow";

/**
 * The reaction feed for one game. On mount the node is read once: every child
 * in that first snapshot is remembered (never animated) and deleted. From then
 * on `child_added` admits each push id once, whatever its timestamp: the
 * sender's own tap arrives through this same path (its optimistic event and
 * the server echo share the key), so both phones behave identically. A
 * reaction leaves `live` after its animation; `react` ignores a second tap
 * inside the tap gap and sends with a single write.
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
    let unsub: (() => void) | null = null;
    const path = rtdbRef(gameReactionsPath(gameId));
    const publish = (next: LiveReaction[]) => {
      liveRef.current = next;
      setLive(next);
    };

    get(path)
      .then((snap) => {
        if (cancelled) return;
        const ids: string[] = [];
        snap.forEach((c) => {
          if (c.key) ids.push(c.key);
        });
        for (const id of ingestExisting(seen, ids)) remove(rtdbRef(`${gameReactionsPath(gameId)}/${id}`)).catch(swallow);
        unsub = onChildAdded(query(path, limitToLast(REACTION_MAX_LIVE)), (c) => {
          if (cancelled) return;
          const r = admitReaction(seen, liveRef.current, c.key ?? "", c.val(), Date.now());
          if (!r.added) return;
          const { id } = r.added;
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
        });
      })
      .catch(swallow);

    return () => {
      cancelled = true;
      unsub?.();
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
