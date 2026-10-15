"use client";

import { cn } from "@/lib/cn";

export function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-[11px] font-bold uppercase tracking-wide text-muted">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={cn("h-full rounded-full transition-[width] duration-500", value < 30 && "animate-pulse")} style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="w-8 text-right text-[11px] tabular-nums text-muted">{Math.round(value)}</span>
    </div>
  );
}
