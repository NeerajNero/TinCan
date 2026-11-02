"use client";

import { useEffect, useRef, useState } from "react";

import { usePair } from "@/hooks/usePair";
import { bumpSnapStreak, snapRef } from "@/lib/db/snaps";
import { onSnapshot } from "@/lib/firebase/fs";
import type { SnapSummaryDoc } from "@/lib/types";

/**
 * Today's snap summary: Home's one new listener (phase 27). Also bumps
 * `pair.snap.streak` once both have posted, the way check-ins bump the
 * streak: one transaction per day per client, the second finds it counted.
 */
export function useSnapToday(today: string): SnapSummaryDoc | null {
  const { uid, friendUid, pair } = usePair();
  const [summary, setSummary] = useState<SnapSummaryDoc | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(snapRef(today), (snap) => setSummary(snap.exists() ? snap.data() : null));
    return () => {
      unsub();
      setSummary(null);
    };
  }, [today]);

  const bothPosted = Boolean(friendUid && summary?.posted?.[uid] && summary?.posted?.[friendUid]);
  const lastCounted = pair.snap?.streak?.lastDateKey ?? null;
  const bumpedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!bothPosted || !summary || lastCounted === today || bumpedFor.current === today) return;
    bumpedFor.current = today;
    bumpSnapStreak(today, summary).catch(() => {
      bumpedFor.current = null;
    });
  }, [bothPosted, summary, lastCounted, today]);

  return summary;
}
