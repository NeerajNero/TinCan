"use client";

import { AnimatePresence, m } from "framer-motion";

const COLORS = ["#ff8fab", "#ffb454", "#6fb6ff", "#5fd3a4", "#b48cff", "#ffd166"];

/** A short burst of paper for bucket-list wins. Keyed on `burst` so each change re-fires. */
export function Confetti({ burst }: { burst: number }) {
  return (
    <AnimatePresence>
      {burst > 0 && (
        <div key={burst} className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden>
          {Array.from({ length: 22 }, (_, i) => {
            const x = 10 + ((i * 37) % 80);
            const delay = (i % 7) * 0.05;
            return (
              <m.span
                key={i}
                className="absolute top-[30%] block h-3 w-2 rounded-sm"
                style={{ left: `${x}%`, background: COLORS[i % COLORS.length] }}
                initial={{ y: 0, opacity: 1, rotate: 0, scale: 1 }}
                animate={{ y: [0, -120 - (i % 5) * 30, 400], x: [0, (i % 2 ? 1 : -1) * (20 + (i % 4) * 15), (i % 2 ? 1 : -1) * 40], rotate: [0, 180, 540], opacity: [1, 1, 0] }}
                transition={{ duration: 1.6, delay, ease: "easeOut", times: [0, 0.35, 1] }}
              />
            );
          })}
        </div>
      )}
    </AnimatePresence>
  );
}
