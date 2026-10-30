"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { useLiveEvents } from "@/components/live/LiveEventsProvider";
import { usePair } from "@/hooks/usePair";
import { trackPlayOpen } from "@/lib/db/play";
import { gameIdForPath, playIdForPath } from "@/lib/play/catalog";
import { swallow } from "@/lib/swallow";

/**
 * Records every Play screen you open on `pair/main.play.recent`. Routes of
 * their own resolve from the path; a board game (`/play/{id}`) resolves its
 * type from the open-games list we already subscribe to. No listener of its own.
 */
export function PlayUsageTracker() {
  const pathname = usePathname();
  const { uid, pair } = usePair();
  const { games } = useLiveEvents();
  const gameId = gameIdForPath(pathname);
  const id = playIdForPath(pathname) ?? (gameId ? (games.find((g) => g.id === gameId)?.type ?? null) : null);
  const usageRef = useRef(pair.play);
  useEffect(() => {
    usageRef.current = pair.play;
  }, [pair.play]);
  useEffect(() => {
    if (!id) return;
    trackPlayOpen(usageRef.current, id, uid).catch(swallow);
  }, [id, uid]);
  return null;
}
