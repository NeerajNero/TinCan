"use client";

import { useNow } from "@/hooks/useNow";
import { usePair } from "@/hooks/usePair";
import { useRelationship } from "@/hooks/useRelationship";
import { roomDateKey } from "@/lib/dates";
import { effectFor, petAccessoryFor, todaysMilestones, type PetAccessory, type Upcoming } from "@/lib/milestones";
import type { Effect } from "@/lib/types";

/** Milestone mode: the yearly milestones (or the friendiversary) that fall today, from the mirrored summary (no reads). */
export function useMilestoneDay(): { today: string; milestones: Upcoming[]; effect: Effect | null; accessory: PetAccessory | null } {
  const { pair } = usePair();
  const preset = useRelationship();
  const today = roomDateKey(pair, useNow(60_000));
  const milestones = todaysMilestones(pair.milestonesSummary, pair.friendsSince, today, preset);
  const effect = milestones.length ? effectFor(milestones) : null;
  return { today, milestones, effect, accessory: effect ? petAccessoryFor(effect) : null };
}
