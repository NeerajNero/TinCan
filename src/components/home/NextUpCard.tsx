"use client";

import { format } from "date-fns";
import Link from "next/link";

import { usePair } from "@/hooks/usePair";
import { useRelationship } from "@/hooks/useRelationship";
import { dateKeyToLocalDate } from "@/lib/dates";
import { nextUp, yearsLine } from "@/lib/milestones";

/** The nearest milestone or friendiversary, from the summary mirrored on pair/main (no extra reads). */
export function NextUpCard({ today }: { today: string }) {
  const { pair } = usePair();
  const preset = useRelationship();
  const next = nextUp(pair.milestonesSummary, pair.friendsSince, today, preset);
  if (!next) return null;
  const title = next.derived && next.years !== null ? yearsLine(next.years, preset.pairNoun) : next.title;
  return (
    <Link href="/memories/milestones" className="card tap flex items-center gap-3 rounded-[24px] px-4 py-3" style={{ "--accent": "var(--accent-memories)" } as React.CSSProperties}>
      <span className="text-3xl" aria-hidden>
        {next.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold uppercase tracking-wide text-muted">Next up</span>
        <span className="block truncate font-heading text-lg font-semibold leading-tight">{title}</span>
        <span className="block text-xs text-muted">{format(dateKeyToLocalDate(next.nextDate), "EEE, d MMM")}</span>
      </span>
      <span className="font-heading text-2xl font-semibold">{next.daysToGo === 0 ? "🎉" : `${next.daysToGo}d`}</span>
    </Link>
  );
}
