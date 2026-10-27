"use client";

import { m } from "framer-motion";

import { cn } from "@/lib/cn";
import { evaluate, MAX_GUESSES, WORD_LEN, type LetterState } from "@/lib/wordle";

export const TILE: Record<LetterState, string> = { correct: "bg-emerald-500 text-white border-emerald-500", present: "bg-amber-400 text-white border-amber-400", absent: "bg-muted/60 text-white border-muted/60" };

/** The 6×5 grid; `compact` is the letterless thumbnail used in comparisons and History. */
export function WordleGrid({ guesses, draft, answer, shake, compact, reveal }: { guesses: string[]; draft: string; answer: string; shake: number; compact?: boolean; reveal?: boolean }) {
  const rows = Array.from({ length: MAX_GUESSES }, (_, r) => guesses[r] ?? (r === guesses.length ? draft : ""));
  return (
    <div className={cn("grid gap-1", compact ? "w-[120px]" : "w-full")} style={{ gridTemplateRows: `repeat(${MAX_GUESSES}, 1fr)` }}>
      {rows.map((row, r) => {
        const submitted = r < guesses.length;
        const states = submitted ? evaluate(row, answer) : null;
        const isDraftRow = r === guesses.length;
        return (
          <m.div key={r} className="grid grid-cols-5 gap-1" animate={isDraftRow && shake ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }} transition={{ duration: 0.35 }}>
            {Array.from({ length: WORD_LEN }, (_, c) => {
              const ch = row[c] ?? "";
              const st = states?.[c];
              return (
                <m.span
                  key={c}
                  initial={false}
                  animate={reveal && submitted ? { rotateX: [90, 0] } : { rotateX: 0 }}
                  transition={{ delay: reveal ? c * 0.12 : 0, duration: 0.25 }}
                  className={cn(
                    "grid aspect-square place-items-center rounded-lg border-2 font-heading font-bold uppercase",
                    compact ? "text-xs" : "text-2xl",
                    st ? TILE[st] : ch ? "border-muted/60" : "border-border",
                  )}
                >
                  {compact ? "" : ch}
                </m.span>
              );
            })}
          </m.div>
        );
      })}
    </div>
  );
}
