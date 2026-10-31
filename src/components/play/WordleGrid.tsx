"use client";

import { m, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/cn";
import { evaluate, MAX_GUESSES, WORD_LEN, type LetterState } from "@/lib/wordle";

export const TILE: Record<LetterState, string> = { correct: "bg-emerald-500 text-white border-emerald-500", present: "bg-amber-400 text-white border-amber-400", absent: "bg-muted/60 text-white border-muted/60" };

/** The 6×5 grid; `compact` is the letterless thumbnail used in comparisons and History. */
export function WordleGrid({ guesses, draft, answer, shake, compact, reveal }: { guesses: string[]; draft: string; answer: string; shake: number; compact?: boolean; reveal?: boolean }) {
  const rows = Array.from({ length: MAX_GUESSES }, (_, r) => guesses[r] ?? (r === guesses.length ? draft : ""));
  const reduce = useReducedMotion();
  // Full size: a `board` 5 wide × 6 tall, so it also fits the GameScreen content height (`--board-fit`).
  return (
    <div className={cn("grid gap-1", compact ? "w-[120px]" : "board aspect-[5/6] [--board-max:min(320px,calc(var(--board-fit,100dvh)*5/6))]")} style={{ gridTemplateRows: `repeat(${MAX_GUESSES}, minmax(0, 1fr))` }} data-grid={compact ? undefined : "word"}>
      {rows.map((row, r) => {
        const submitted = r < guesses.length;
        const states = submitted ? evaluate(row, answer) : null;
        const isDraftRow = r === guesses.length;
        return (
          <m.div key={r} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${WORD_LEN}, minmax(0, 1fr))` }} animate={isDraftRow && shake ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }} transition={{ duration: 0.35 }}>
            {Array.from({ length: WORD_LEN }, (_, c) => {
              const ch = row[c] ?? "";
              const st = states?.[c];
              return (
                <m.span
                  key={c}
                  initial={false}
                  // Entry pops the tile (1.1 → 1); a submitted row flips as its colours fade in. Reduced motion keeps only the colour change.
                  animate={reduce ? { rotateX: 0, scale: 1 } : reveal && submitted ? { rotateX: [90, 0], scale: 1 } : { rotateX: 0, scale: ch && isDraftRow ? [1.1, 1] : 1 }}
                  transition={{ delay: reveal && submitted && !reduce ? c * 0.12 : 0, duration: reveal && submitted ? 0.25 : 0.12 }}
                  className={cn(
                    "grid min-h-0 min-w-0 place-items-center rounded-lg border-2 font-heading font-bold uppercase transition-colors duration-150",
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
