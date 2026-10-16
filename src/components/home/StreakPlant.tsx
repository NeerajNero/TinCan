"use client";

import { AnimatePresence, m } from "framer-motion";
import { useState } from "react";

import { Card } from "@/components/ui/Card";
import { PLANT_STAGE_NAMES, PLANT_STAGES, PlantSvg } from "@/content/plant";
import { usePair } from "@/hooks/usePair";
import { cn } from "@/lib/cn";
import { isPlantWilted, MAX_PLANT_STAGE, plantStageFor } from "@/lib/db/home";

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
  const [open, setOpen] = useState(false);
  const daysToNext = stage >= MAX_PLANT_STAGE ? 0 : Math.max(0, stage * 3 - count);

  return (
    <Card className="flex items-center gap-4">
      <m.div
        role="button"
        tabIndex={0}
        aria-label="About the plant"
        onClick={() => setOpen(true)}
        onKeyDown={(e) => e.key === "Enter" && setOpen(true)}
        className="w-28 shrink-0 cursor-pointer"
        animate={wilted ? { rotate: 0 } : { rotate: [-1.5, 1.5, -1.5] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <PlantSvg stage={stage} wilted={wilted} className="h-auto w-full" />
      </m.div>
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

      <AnimatePresence>
        {open && (
          <>
            <m.button key="bd" type="button" aria-label="Close" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-black/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <m.div key="sheet" role="dialog" aria-label="Plant" className="fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-[480px] flex-col items-center gap-2 rounded-t-[28px] bg-surface p-5 pb-[max(env(safe-area-inset-bottom),20px)] text-center shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.3)]" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 420, damping: 38 }}>
              <div className="mx-auto h-1.5 w-10 rounded-full bg-border" aria-hidden />
              <PlantSvg stage={stage} wilted={wilted} className="h-44 w-44" />
              <p className="font-heading text-2xl font-semibold">{PLANT_STAGE_NAMES[stage - 1]}</p>
              <p className="text-sm text-muted">
                Stage {stage} of {PLANT_STAGES.length} · {count}-day streak
              </p>
              <p className="text-sm">{stage >= MAX_PLANT_STAGE ? "Fully grown — keep it watered 🌸" : `${daysToNext} ${daysToNext === 1 ? "day" : "days"} of streak to the next stage`}</p>
              {wilted && <p className="rounded-2xl bg-amber-400/20 px-3 py-2 text-xs">A day was missed, so it&apos;s drooping. It perks back up the next day you both open the app, and the stage never goes down.</p>}
            </m.div>
          </>
        )}
      </AnimatePresence>
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
