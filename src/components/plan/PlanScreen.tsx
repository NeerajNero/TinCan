"use client";

import Link from "next/link";

import { CountdownHero } from "@/components/plan/CountdownHero";
import { UpcomingSection } from "@/components/plan/UpcomingSection";
import { useHeader } from "@/components/shell/HeaderProvider";
import { useNow } from "@/hooks/useNow";
import { usePair } from "@/hooks/usePair";
import { roomDateKey } from "@/lib/dates";
import { LIST_META } from "@/lib/db/lists";
import { LIST_KINDS } from "@/lib/types";

/** Plan (phase 29): hero countdown → Upcoming (7 days inline) → Lists (Bucket, Wishlist) → Trips. */
export function PlanScreen() {
  const { pair } = usePair();
  useHeader({ emoji: "🗓️", title: "Plan", help: "plan" });
  const now = useNow(60_000);
  const today = roomDateKey(pair, now);

  return (
    <div className="flex flex-col gap-4">

      <CountdownHero today={today} />

      <UpcomingSection today={today} />

      <div className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-bold tracking-wide text-muted uppercase">Lists</h2>
        <div className="grid grid-cols-2 gap-3">
          {LIST_KINDS.map((kind) => (
            <Link key={kind} href={`/plan/lists/${kind}`} className="card tap flex flex-col items-start gap-1.5 rounded-[24px] p-4">
              <span className="text-3xl" aria-hidden>
                {LIST_META[kind].emoji}
              </span>
              <span className="font-heading text-lg leading-tight font-semibold">{LIST_META[kind].title}</span>
              <span className="text-xs text-muted">{LIST_META[kind].blurb}</span>
            </Link>
          ))}
        </div>
      </div>

      <Link href="/plan/trips" className="card tap flex items-center gap-4 rounded-[24px] px-4 py-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent-soft text-2xl" aria-hidden>
          🧳
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-heading text-lg font-semibold">Trips</span>
          <span className="block text-sm text-muted">Day-by-day plans for when you&apos;re together</span>
        </span>
      </Link>
    </div>
  );
}
