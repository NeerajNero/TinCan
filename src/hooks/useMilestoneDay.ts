"use client";

import { useNow } from "@/hooks/useNow";
import { usePair } from "@/hooks/usePair";
import { useRelationship } from "@/hooks/useRelationship";
import { roomDateKey } from "@/lib/dates";
import { todaysMilestones, type Upcoming } from "@/lib/milestones";

/** Milestone mode: the yearly milestones (or the friendiversary) that fall today, from the mirrored summary (no reads). */
export function useMilestoneDay(): { today: string; milestones: Upcoming[] } {
  const { pair } = usePair();
  const preset = useRelationship();
  const today = roomDateKey(pair, useNow(60_000));
  return { today, milestones: todaysMilestones(pair.milestonesSummary, pair.friendsSince, today, preset) };
}
