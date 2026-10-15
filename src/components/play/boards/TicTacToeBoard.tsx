"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/cn";
import type { TttState } from "@/lib/games/tictactoe";

export function TicTacToeBoard({ state, canMove, legal, line, onMove }: { state: TttState; canMove: boolean; legal: number[]; line?: number[]; onMove: (i: number) => void }) {
  return (
    <div className="mx-auto grid w-full max-w-[320px] grid-cols-3 gap-2">
      {Array.from(state.board).map((ch, i) => {
        const win = line?.includes(i);
        return (
          <button
            key={i}
            type="button"
            disabled={!canMove || !legal.includes(i)}
            onClick={() => onMove(i)}
            aria-label={`Cell ${i + 1}${ch !== "." ? `, ${ch}` : ""}`}
            className={cn("card grid aspect-square place-items-center rounded-[20px] text-5xl font-bold disabled:cursor-default", win && "bg-accent-soft ring-2 ring-[var(--accent)]")}
          >
            {ch !== "." && (
              <motion.span initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 500, damping: 20 }} className={ch === "X" ? "text-[var(--accent)]" : "text-[var(--accent-memories)]"}>
                {ch}
              </motion.span>
            )}
          </button>
        );
      })}
    </div>
  );
}
