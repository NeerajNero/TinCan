"use client";

import { m } from "framer-motion";

import { cn } from "@/lib/cn";
import { dotsScores, type DotsMove, type DotsState } from "@/lib/games/dots";
import type { Player } from "@/lib/games/types";

const S = 60; // dot spacing in viewBox units
const PAD = 14;
const DOT = 5;
const EDGE = 7;
const HIT = 26;

const sameMove = (a: DotsMove | null, b: DotsMove) => a?.kind === b.kind && a.i === b.i;

/**
 * Dots and Boxes as one SVG: dots, tappable gaps (a wide hit area around each
 * edge), claimed edges and filled boxes with the owner's initial. The last
 * line drawn glows so the other player sees what just happened.
 */
export function DotsBoard({ state, me, canMove, legal, names, onMove }: { state: DotsState; me: Player | null; canMove: boolean; legal: DotsMove[]; names: { first: string; second: string }; onMove: (m: DotsMove) => void }) {
  const n = state.size;
  const b = n - 1;
  const size = PAD * 2 + S * b;
  const scores = dotsScores(state);
  const legalKey = new Set(legal.map((l) => `${l.kind}${l.i}`));
  const fill = (p: Player) => (p === "first" ? "var(--accent)" : "var(--accent-memories)");

  const edges: Array<{ move: DotsMove; x: number; y: number; w: number; h: number; taken: boolean }> = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < b; c++) {
      const i = r * b + c;
      edges.push({ move: { kind: "h", i }, x: PAD + c * S, y: PAD + r * S, w: S, h: 0, taken: state.h[i] === "#" });
    }
  }
  for (let r = 0; r < b; r++) {
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      edges.push({ move: { kind: "v", i }, x: PAD + c * S, y: PAD + r * S, w: 0, h: S, taken: state.v[i] === "#" });
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full max-w-[360px] items-center justify-between gap-2 text-sm font-bold" aria-live="polite">
        <ScorePill p="first" name={names.first} score={scores.first} active={state.turn === "first"} mine={me === "first"} />
        <span className="text-xs text-muted">{b * b - scores.first - scores.second} left</span>
        <ScorePill p="second" name={names.second} score={scores.second} active={state.turn === "second"} mine={me === "second"} right />
      </div>
      <svg viewBox={`0 0 ${size} ${size}`} className="card w-full max-w-[360px] rounded-[24px] p-2" role="group" aria-label="Dots and Boxes board">
        {Array.from(state.boxes).map((owner, k) => {
          if (owner === ".") return null;
          const r = Math.floor(k / b);
          const c = k % b;
          const p: Player = owner === "A" ? "first" : "second";
          return (
            <g key={k}>
              <m.rect initial={{ opacity: 0 }} animate={{ opacity: 0.35 }} x={PAD + c * S + EDGE / 2} y={PAD + r * S + EDGE / 2} width={S - EDGE} height={S - EDGE} rx={8} fill={fill(p)} />
              <text x={PAD + c * S + S / 2} y={PAD + r * S + S / 2 + 1} textAnchor="middle" dominantBaseline="middle" fontSize={22} fontWeight={700} fill={fill(p)}>
                {(p === "first" ? names.first : names.second).slice(0, 1).toUpperCase()}
              </text>
            </g>
          );
        })}
        {edges.map((e) => {
          const key = `${e.move.kind}${e.move.i}`;
          const horizontal = e.move.kind === "h";
          const last = sameMove(state.last, e.move);
          const playable = canMove && legalKey.has(key);
          return (
            <g key={key}>
              {e.taken && (
                <m.rect
                  initial={last ? { opacity: 0 } : false}
                  animate={{ opacity: 1 }}
                  x={horizontal ? e.x + DOT : e.x - EDGE / 2}
                  y={horizontal ? e.y - EDGE / 2 : e.y + DOT}
                  width={horizontal ? S - DOT * 2 : EDGE}
                  height={horizontal ? EDGE : S - DOT * 2}
                  rx={EDGE / 2}
                  fill={last ? "var(--accent)" : "var(--text)"}
                  opacity={last ? 1 : 0.8}
                />
              )}
              {!e.taken && (
                <rect
                  x={horizontal ? e.x + DOT : e.x - HIT / 2}
                  y={horizontal ? e.y - HIT / 2 : e.y + DOT}
                  width={horizontal ? S - DOT * 2 : HIT}
                  height={horizontal ? HIT : S - DOT * 2}
                  rx={HIT / 2}
                  fill="var(--text)"
                  opacity={playable ? 0.07 : 0.03}
                  className={cn(playable && "cursor-pointer")}
                  role="button"
                  tabIndex={playable ? 0 : -1}
                  aria-label={`Draw a ${horizontal ? "horizontal" : "vertical"} line ${e.move.i + 1}`}
                  aria-disabled={!playable}
                  onClick={() => playable && onMove(e.move)}
                  onKeyDown={(ev) => {
                    if (playable && (ev.key === "Enter" || ev.key === " ")) onMove(e.move);
                  }}
                />
              )}
            </g>
          );
        })}
        {Array.from({ length: n * n }, (_, k) => (
          <circle key={k} cx={PAD + (k % n) * S} cy={PAD + Math.floor(k / n) * S} r={DOT} fill="var(--text)" />
        ))}
      </svg>
    </div>
  );
}

function ScorePill({ p, name, score, active, mine, right }: { p: Player; name: string; score: number; active: boolean; mine: boolean; right?: boolean }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5 rounded-full px-3 py-1", active ? "bg-accent-soft" : "bg-surface-2", right && "flex-row-reverse")}>
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: p === "first" ? "var(--accent)" : "var(--accent-memories)" }} aria-hidden />
      <span className="truncate">{mine ? "You" : name}</span>
      <span className="tabular-nums">{score}</span>
    </span>
  );
}
