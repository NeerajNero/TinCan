"use client";

import { m } from "framer-motion";
import { useEffect, useState } from "react";

import { Confetti } from "@/components/plan/Confetti";
import { useMilestoneDay } from "@/hooks/useMilestoneDay";
import { useRelationship } from "@/hooks/useRelationship";
import { readPref, writePref } from "@/lib/localPref";
import { yearsLine } from "@/lib/milestones";

const CONFETTI_KEY = "tincan:milestone-confetti";

/** Milestone mode's banner: today's milestone(s) with confetti on the first open of the day (per device). */
export function MilestoneBanner() {
  const { today, milestones } = useMilestoneDay();
  const preset = useRelationship();
  const [burst, setBurst] = useState(0);
  const any = milestones.length > 0;

  useEffect(() => {
    if (!any || readPref(CONFETTI_KEY) === today) return;
    writePref(CONFETTI_KEY, today);
    const t = setTimeout(() => setBurst(1), 300);
    return () => clearTimeout(t);
  }, [any, today]);

  if (!any) return null;
  return (
    <>
      <m.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card flex items-center gap-3 rounded-[24px] bg-gradient-to-r from-[#ffd166]/40 via-[#ff8fab]/30 to-[#b48cff]/30 px-4 py-3">
        <m.span className="text-4xl" aria-hidden animate={{ rotate: [-8, 8, -8] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}>
          {milestones[0]!.emoji}
        </m.span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold uppercase tracking-wide text-muted">🎉 Today</span>
          {milestones.map((ms) => (
            <span key={ms.id} className="block truncate font-heading text-lg font-semibold leading-tight">
              {ms.derived && ms.years !== null ? yearsLine(ms.years, preset.pairNoun) : ms.title}
            </span>
          ))}
        </span>
      </m.div>
      <Confetti burst={burst} />
    </>
  );
}
