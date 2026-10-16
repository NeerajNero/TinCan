"use client";

import { m } from "framer-motion";

import { cn } from "@/lib/cn";

/** A need bar. The fill scales on X (no layout work) and glides to each new value over 800 ms. */
export function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-[11px] font-bold uppercase tracking-wide text-muted">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <m.div
          className={cn("h-full w-full rounded-full", value < 30 && "animate-pulse")}
          style={{ background: color, originX: 0 }}
          initial={false}
          animate={{ scaleX: value / 100 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="w-8 text-right text-[11px] tabular-nums text-muted">{Math.round(value)}</span>
    </div>
  );
}
