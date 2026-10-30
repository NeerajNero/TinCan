"use client";

import { Delete } from "lucide-react";

import { TILE } from "@/components/play/WordleGrid";
import { cn } from "@/lib/cn";
import { KEY_ROWS, type LetterState } from "@/lib/wordle";

/**
 * The on-screen letter keyboard shared by the daily word and Hangman. One CSS
 * grid of 20 `minmax(0, 1fr)` columns: a letter spans two, the staggered rows
 * start a column in, Enter / Backspace span three. Every key is `min-width: 0`,
 * so the rows always fit the viewport (down to 320 px) and never scroll sideways.
 *
 * `states`: a letter's colour (correct / present / absent); anything else is
 * unused. `isDisabled(letter)` greys a key out and ignores taps; `pending` pulses
 * the key whose tap is in flight; `withActions` adds Enter and Backspace.
 */
export function LetterKeyboard({ states, onKey, isDisabled, pending = null, disabled = false, withActions = false, label = "Letters", keyLabel = (k) => k }: { states: Partial<Record<string, LetterState>>; onKey: (key: string) => void; isDisabled?: (letter: string) => boolean; pending?: string | null; disabled?: boolean; withActions?: boolean; label?: string; keyLabel?: (letter: string) => string }) {
  const keyClass = "tap grid h-12 min-w-0 place-items-center rounded-lg text-sm font-bold uppercase disabled:opacity-50";
  return (
    <div role="group" aria-label={label} className="grid w-full gap-x-1 gap-y-1.5" style={{ gridTemplateColumns: "repeat(20, minmax(0, 1fr))" }}>
      {KEY_ROWS.map((row, i) => {
        const letters = row.split("");
        // Row widths in columns: 20, 18 and (with actions) 3 + 14 + 3 = 20, else 14.
        const used = letters.length * 2 + (withActions && i === 2 ? 6 : 0);
        const start = Math.floor((20 - used) / 2) + 1;
        return letters.map((k, j) => {
          const first = j === 0;
          const last = j === letters.length - 1;
          const state = states[k];
          const off = disabled || Boolean(isDisabled?.(k));
          return (
            <span key={k} className="contents">
              {withActions && i === 2 && first && (
                <button type="button" onClick={() => onKey("enter")} disabled={disabled} className={cn(keyClass, "bg-surface-2 px-0 text-[10px] tracking-tight")} style={{ gridColumn: `${start} / span 3` }}>
                  ENTER
                </button>
              )}
              <button
                type="button"
                onClick={() => onKey(k)}
                disabled={off}
                aria-label={keyLabel(k)}
                className={cn(keyClass, state ? TILE[state] : "bg-surface-2", pending === k && "animate-pulse")}
                style={{ gridColumn: `${start + (withActions && i === 2 ? 3 : 0) + j * 2} / span 2` }}
              >
                {k}
              </button>
              {withActions && i === 2 && last && (
                <button type="button" onClick={() => onKey("back")} disabled={disabled} aria-label="Backspace" className={cn(keyClass, "bg-surface-2 px-0")} style={{ gridColumn: `${start + 3 + letters.length * 2} / span 3` }}>
                  <Delete size={18} />
                </button>
              )}
            </span>
          );
        });
      })}
    </div>
  );
}
