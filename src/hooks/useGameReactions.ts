"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { gameReactionsPath, sendGameReaction } from "@/lib/db/reactions";
import { get, limitToLast, onChildAdded, query, remove } from "@/lib/firebase/rt";
import { admitReaction, ingestExisting, REACTION_LIFE_MS, REACTION_MAX_LIVE, tapAllowed, type LiveReaction } from "@/lib/reactions";
import { rtdbRef } from "@/lib/rtdb";
import { swallow } from "@/lib/swallow";

/**
 * The reaction feed for one game. On mount every existing child is remembered
 * (never animated) and deleted; from then on `child_added` admits each push id
 * once, which also covers the sender's optimistic event and its server echo.
 * A reaction leaves `live` after its animation; `react` ignores a second tap
 * inside the tap gap and sends with a single write.
 */
export function useGameReactions(gameId: string, uid: string): { live: LiveReaction[]; react: (emoji: string) => void } {
  const [live, setLive] = useState<LiveReaction[]>([]);
  const seen = useRef(new Set<string>());
  const lastTap = useRef<number | null>(null);

  useEffect(() => {
    const mine = new Set<string>();
    seen.current = mine;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let cancelled = false;
    let unsub: (() => void) | null = null;
    const path = rtdbRef(gameReactionsPath(gameId));

    get(path)
      .then((snap) => {
        if (cancelled) return;
        const ids: string[] = [];
        snap.forEach((c) => {
          if (c.key) ids.push(c.key);
        });
        for (const id of ingestExisting(mine, ids)) remove(rtdbRef(`${gameReactionsPath(gameId)}/${id}`)).catch(swallow);
        unsub = onChildAdded(query(path, limitToLast(REACTION_MAX_LIVE)), (c) => {
          const now = Date.now();
          let added: LiveReaction | null = null;
          setLive((prev) => {
            const r = admitReaction(mine, prev, c.key ?? "", c.val(), now);
            added = r.added;
            return r.added ? r.live : prev;
          });
          // setLive's updater runs synchronously here (outside a render), so `added` is known.
          if (!added) return;
          const id = (added as LiveReaction).id;
          try {
            navigator.vibrate?.(20);
          } catch {
            // no haptics
          }
          const t = setTimeout(() => {
            timers.delete(t);
            setLive((prev) => prev.filter((x) => x.id !== id));
          }, REACTION_LIFE_MS);
          timers.add(t);
        });
      })
      .catch(swallow);

    return () => {
      cancelled = true;
      unsub?.();
      for (const t of timers) clearTimeout(t);
      setLive([]);
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
