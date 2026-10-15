"use client";

import { useSyncExternalStore } from "react";

import { Card } from "@/components/ui/Card";
import { useNow } from "@/hooks/useNow";
import { cn } from "@/lib/cn";
import { getUsage, subscribeUsage } from "@/lib/firebase/fs";

/** Spark plan daily quotas. */
const READS_QUOTA = 50_000;
const WRITES_QUOTA = 20_000;

function Gauge({ label, used, projected, quota }: { label: string; used: number; projected: number; quota: number }) {
  const pct = Math.min(100, (projected / quota) * 100);
  const tone = pct < 40 ? "bg-emerald-400" : pct < 80 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="text-xs text-muted">
          {used.toLocaleString()} this session · ~{Math.round(projected).toLocaleString()} / {quota.toLocaleString()} a day
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={cn("h-full rounded-full transition-[width] duration-500", tone)} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
    </div>
  );
}

/** Reads/writes counted on this device since the app opened, stretched to a day against the free quota. */
export function UsageCard() {
  const usage = useSyncExternalStore(subscribeUsage, getUsage, getUsage);
  const now = useNow(10_000);
  const minutes = Math.max(1, (now.getTime() - usage.startedAt) / 60_000);
  const perDay = (n: number) => (n / minutes) * 1440;
  const worst = Math.max(perDay(usage.reads) / READS_QUOTA, perDay(usage.writes) / WRITES_QUOTA);
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-xl" aria-hidden>
          {worst < 0.4 ? "🌱" : worst < 0.8 ? "🌤️" : "🔥"}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-tight">Usage meter</h2>
          <p className="text-xs text-muted">{worst < 0.4 ? "Comfortably inside the free plan" : worst < 0.8 ? "Busy, but fine" : "Heavy day — reads are adding up"} · {Math.round(minutes)} min open</p>
        </div>
      </div>
      <Gauge label="Firestore reads" used={usage.reads} projected={perDay(usage.reads)} quota={READS_QUOTA} />
      <Gauge label="Firestore writes" used={usage.writes} projected={perDay(usage.writes)} quota={WRITES_QUOTA} />
      <p className="text-[11px] text-muted">Counted on this phone only, from the moment the app opened; the other phone has its own meter. Cached reads aren&apos;t billed and aren&apos;t counted.</p>
    </Card>
  );
}
