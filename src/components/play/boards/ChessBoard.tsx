"use client";

import { Chess, type Square } from "chess.js";
import { AnimatePresence, m } from "framer-motion";
import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { capturedPieces, inCheck, PIECE_GLYPH, type ChessMove, type ChessState } from "@/lib/games/chess";
import type { Player } from "@/lib/games/types";

const FILES = "abcdefgh";

export function ChessBoard({ state, me, canMove, legal, onMove }: { state: ChessState; me: Player | null; canMove: boolean; legal: ChessMove[]; onMove: (m: ChessMove) => void }) {
  const [selected, setSelected] = useState<Square | null>(null);
  const [promo, setPromo] = useState<{ from: Square; to: Square } | null>(null);
  const flip = me === "second";
  const board = useMemo(() => new Chess(state.fen).board(), [state.fen]);
  const check = useMemo(() => inCheck(state), [state]);
  const captured = useMemo(() => capturedPieces(state.fen), [state.fen]);
  const turnColor = state.fen.split(" ")[1];
  const fromSel = selected ? legal.filter((m) => m.from === selected) : [];
  const targets = new Set(fromSel.map((m) => m.to));
  const movable = new Set(legal.map((m) => m.from));
  const kingSq = useMemo(() => {
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const p = board[r]?.[f];
      if (p && p.type === "k" && p.color === turnColor) return `${FILES[f]}${8 - r}`;
    }
    return null;
  }, [board, turnColor]);

  function tap(sq: Square) {
    if (!canMove) return;
    if (selected && targets.has(sq)) {
      const options = fromSel.filter((m) => m.to === sq);
      const first = options[0];
      if (options.some((m) => m.promotion)) {
        setPromo({ from: selected, to: sq });
      } else if (first) {
        onMove(first);
      }
      setSelected(null);
      return;
    }
    setSelected(movable.has(sq) ? sq : null);
  }

  const squares: Square[] = [];
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) squares.push(`${FILES[f]}${8 - r}` as Square);
  const ordered = flip ? [...squares].reverse() : squares;

  return (
    <div className="mx-auto flex w-full max-w-[360px] flex-col gap-2">
      <CapturedRow pieces={flip ? captured.byFirst : captured.bySecond} />
      <div className="grid grid-cols-8 overflow-hidden rounded-[20px] border-4 border-[#5b4636]">
        {ordered.map((sq) => {
          const f = FILES.indexOf(sq.charAt(0));
          const r = 8 - Number(sq[1]);
          const piece = board[r]?.[f];
          const light = (r + f) % 2 === 0;
          const glyph = piece ? PIECE_GLYPH[piece.color === "w" ? piece.type.toUpperCase() : piece.type] : "";
          const last = state.lastMove && (state.lastMove.from === sq || state.lastMove.to === sq);
          const isCheckSq = check && kingSq === sq;
          return (
            <button
              key={sq}
              type="button"
              onClick={() => tap(sq)}
              aria-label={`${sq}${piece ? `, ${piece.color === "w" ? "white" : "black"} ${piece.type}` : ""}`}
              className={cn(
                "relative grid aspect-square place-items-center text-[26px] leading-none",
                light ? "bg-[#f0d9b5]" : "bg-[#b58863]",
                last && "bg-[#f6f669]/70",
                selected === sq && "ring-inset ring-4 ring-[var(--accent)]",
                isCheckSq && "bg-red-400",
              )}
            >
              {glyph && <span className={cn("drop-shadow", piece?.color === "w" ? "text-white [text-shadow:0_0_2px_#000]" : "text-black")}>{glyph}</span>}
              {targets.has(sq) && <span className={cn("absolute rounded-full bg-[var(--accent)]/80", piece ? "inset-1 border-4 border-[var(--accent)]/70 bg-transparent" : "size-3")} aria-hidden />}
            </button>
          );
        })}
      </div>
      <CapturedRow pieces={flip ? captured.bySecond : captured.byFirst} />
      {check && <p className="text-center text-sm font-bold text-red-500">Check!</p>}

      <AnimatePresence>
        {promo && (
          <m.div key="promo" role="dialog" aria-label="Promote to" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card flex items-center justify-center gap-2 rounded-[20px] p-3">
            <span className="text-sm font-bold text-muted">Promote to</span>
            {(["q", "r", "b", "n"] as const).map((p) => (
              <button key={p} type="button" onClick={() => { onMove({ from: promo.from, to: promo.to, promotion: p }); setPromo(null); }} className="tap grid size-11 place-items-center rounded-full bg-surface-2 text-2xl">
                {PIECE_GLYPH[me === "second" ? p : p.toUpperCase()]}
              </button>
            ))}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CapturedRow({ pieces }: { pieces: string[] }) {
  return <div className="flex h-6 flex-wrap gap-0.5 px-1 text-lg leading-none text-muted">{pieces.map((p, i) => <span key={i}>{PIECE_GLYPH[p]}</span>)}</div>;
}
