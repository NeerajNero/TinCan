"use client";

import { motion } from "framer-motion";

import { Card } from "@/components/ui/Card";
import { usePair } from "@/hooks/usePair";
import { PLANT_STAGE_NAMES, PlantSvg } from "@/content/plant";
import { isPlantWilted, plantStageFor } from "@/lib/db/home";
import { cn } from "@/lib/cn";

interface StreakPlantProps {
  today: string;
  checkins: Record<string, boolean>;
  friendUid: string;
  friendName: string;
}

/** Flame streak + the plant that grows with it. */
export function StreakPlant({ today, checkins, friendUid, friendName }: StreakPlantProps) {
  const { uid, pair } = usePair();
  const streak = pair.streak;
  const count = streak?.count ?? 0;
  const countedToday = streak?.lastDateKey === today;
  const stage = Math.max(pair.plant?.stage ?? 1, plantStageFor(count));
  const wilted = isPlantWilted(streak, today);

  const meIn = Boolean(checkins[uid]);
  const friendIn = Boolean(checkins[friendUid]);

  return (
    <Card className="flex items-center gap-4">
      <motion.div
        className="w-28 shrink-0"
        animate={wilted ? { rotate: 0 } : { rotate: [-1.5, 1.5, -1.5] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <PlantSvg stage={stage} wilted={wilted} className="h-auto w-full" />
      </motion.div>
      <div className="min-w-0 flex-1">
        <p className="font-heading text-3xl font-semibold">
          🔥 {count} <span className="text-base font-bold text-muted">{count === 1 ? "day" : "days"}</span>
        </p>
        <p className="text-sm font-semibold">
          {PLANT_STAGE_NAMES[stage - 1]}
          {wilted && <span className="text-muted"> · a little droopy</span>}
        </p>
        <p className="mt-1 text-xs text-muted">
          {countedToday
            ? "Both here today — counted!"
            : meIn && !friendIn
              ? `Waiting for ${friendName} to pop in today.`
              : "Open the app on the same day to keep it growing."}
        </p>
        <div className="mt-2 flex gap-1.5" aria-label="Today's check-ins">
          <Dot on={meIn} label="You" />
          <Dot on={friendIn} label={friendName} />
        </div>
      </div>
    </Card>
  );
}

function Dot({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", on ? "bg-emerald-400/25 text-emerald-700 dark:text-emerald-300" : "bg-surface-2 text-muted")}>
      {on ? "✓" : "·"} {label}
    </span>
  );
}
