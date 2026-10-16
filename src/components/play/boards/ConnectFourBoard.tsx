"use client";

import { m } from "framer-motion";

import { cn } from "@/lib/cn";
import { C4_COLS, C4_ROWS, type C4State } from "@/lib/games/connectfour";

export function ConnectFourBoard({ state, canMove, legal, line, onMove }: { state: C4State; canMove: boolean; legal: number[]; line?: number[]; onMove: (col: number) => void }) {
  return (
    <div className="mx-auto w-full max-w-[360px] rounded-[24px] bg-[var(--accent-chat)]/80 p-2">
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: C4_COLS }, (_, c) => (
          <button key={`drop-${c}`} type="button" disabled={!canMove || !legal.includes(c)} onClick={() => onMove(c)} aria-label={`Drop in column ${c + 1}`} className="tap grid h-9 place-items-center rounded-full text-white/80 disabled:opacity-30">
            ▼
          </button>
        ))}
        {Array.from({ length: C4_ROWS * C4_COLS }, (_, i) => {
          const ch = state.board[i];
          const col = i % C4_COLS;
          const row = Math.floor(i / C4_COLS);
          const win = line?.includes(i);
          return (
            <button key={i} type="button" disabled={!canMove || !legal.includes(col)} onClick={() => onMove(col)} aria-label={`Row ${row + 1} column ${col + 1}`} className="grid aspect-square place-items-center rounded-full bg-bg disabled:cursor-default">
              {ch !== "." && (
                <m.span
                  key={`${i}-${ch}`}
                  initial={state.last === i ? { y: -(row + 1) * 44, opacity: 0.8 } : false}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 420, damping: 24 }}
                  className={cn("block size-[82%] rounded-full shadow-inner", ch === "R" ? "bg-[#ff6b6b]" : "bg-[#ffd166]", win && "ring-4 ring-white")}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
