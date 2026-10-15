"use client";

import { motion } from "framer-motion";
import { useState } from "react";

import { cn } from "@/lib/cn";
import { checkersHelpers, type CheckersMove, type CheckersState } from "@/lib/games/checkers";
import type { Player } from "@/lib/games/types";

const { ownerOf, isKing } = checkersHelpers;

export function CheckersBoard({ state, me, canMove, legal, onMove }: { state: CheckersState; me: Player | null; canMove: boolean; legal: CheckersMove[]; onMove: (m: CheckersMove) => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const flip = me === "second";
  const fromSel = selected === null ? [] : legal.filter((m) => m.path[0] === selected);
  const targets = new Map(fromSel.map((m) => [m.path[m.path.length - 1], m]));
  const movable = new Set(legal.map((m) => m.path[0]));

  function tap(i: number) {
    if (!canMove) return;
    const t = targets.get(i);
    if (t) {
      setSelected(null);
      onMove(t);
      return;
    }
    setSelected(movable.has(i) ? i : null);
  }

  const order = Array.from({ length: 64 }, (_, k) => (flip ? 63 - k : k));

  return (
    <div className="mx-auto grid w-full max-w-[360px] grid-cols-8 overflow-hidden rounded-[20px] border-4 border-[#7a5236]">
      {order.map((i) => {
        const r = Math.floor(i / 8);
        const c = i % 8;
        const dark = (r + c) % 2 === 1;
        const ch = state.board[i];
        const owner = ownerOf(ch);
        const target = targets.has(i);
        const onPath = fromSel.some((m) => m.captures.includes(i));
        return (
          <button
            key={i}
            type="button"
            onClick={() => tap(i)}
            aria-label={`Square ${String.fromCharCode(97 + c)}${8 - r}${owner ? `, ${owner === "first" ? "red" : "black"} piece` : ""}`}
            className={cn("relative grid aspect-square place-items-center", dark ? "bg-[#8b5e3c]" : "bg-[#f2d6b3]", selected === i && "ring-inset ring-4 ring-[var(--accent)]", onPath && "bg-red-400/60")}
          >
            {owner && (
              <motion.span
                layout
                className={cn("grid size-[78%] place-items-center rounded-full text-base shadow-md", owner === "first" ? "bg-[#e63946] text-white" : "bg-[#1d1d2b] text-white", canMove && movable.has(i) && selected === null && "ring-2 ring-white/70")}
              >
                {isKing(ch) ? "♛" : ""}
              </motion.span>
            )}
            {target && <span className="absolute size-3 rounded-full bg-[var(--accent)] shadow" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}
