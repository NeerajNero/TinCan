"use client";

import { m } from "framer-motion";

import { cn } from "@/lib/cn";
import type { TttState } from "@/lib/games/tictactoe";

export function TicTacToeBoard({ state, canMove, legal, line, onMove }: { state: TttState; canMove: boolean; legal: number[]; line?: number[]; onMove: (i: number) => void }) {
  return (
    <div data-grid="tictactoe" className="board @container grid aspect-square gap-2 [--board-max:320px]" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gridTemplateRows: "repeat(3, minmax(0, 1fr))" }}>
      {Array.from(state.board).map((ch, i) => {
        const win = line?.includes(i);
        return (
          <button
            key={i}
            type="button"
            disabled={!canMove || !legal.includes(i)}
            onClick={() => onMove(i)}
            aria-label={`Cell ${i + 1}${ch !== "." ? `, ${ch}` : ""}`}
            data-cell
            className={cn("card grid min-h-0 min-w-0 place-items-center rounded-[20px] font-bold disabled:cursor-default", win && "bg-accent-soft ring-2 ring-[var(--accent)]")}
          >
            {ch !== "." && (
              <m.span initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 500, damping: 20 }} className={cn("text-[18cqw] leading-none", ch === "X" ? "text-[var(--accent)]" : "text-[var(--accent-memories)]")}>
                {ch}
              </m.span>
            )}
          </button>
        );
      })}
    </div>
  );
}
