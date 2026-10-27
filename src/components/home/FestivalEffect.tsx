"use client";

import { AnimatePresence, m, useReducedMotion } from "framer-motion";

import { Confetti } from "@/components/plan/Confetti";
import { Portal, Z } from "@/components/ui/Portal";
import type { Effect } from "@/lib/types";

/** Deterministic spread so the burst looks the same each time without Math.random in render. */
const spread = (i: number, step: number, from: number, span: number) => from + ((i * step) % span);

interface Particle {
  glyph?: string;
  color?: string;
  left: number;
  top: number;
  size: number;
  delay: number;
  duration: number;
  animate: Record<string, number[] | number>;
}

/** ≤ 20 particles per effect, transforms and opacity only. */
function particles(effect: Exclude<Effect, "confetti">): Particle[] {
  switch (effect) {
    case "snow":
      return Array.from({ length: 20 }, (_, i) => ({ glyph: "❄️", left: spread(i, 41, 2, 96), top: -8, size: 14 + (i % 4) * 4, delay: (i % 10) * 0.25, duration: 4 + (i % 3), animate: { y: [0, 900], x: [0, (i % 2 ? 1 : -1) * 30, 0], rotate: [0, 180], opacity: [0, 1, 1, 0] } }));
    case "diyas":
      return Array.from({ length: 12 }, (_, i) => ({ glyph: "🪔", left: spread(i, 31, 4, 92), top: 84 + (i % 3) * 4, size: 24 + (i % 3) * 4, delay: i * 0.12, duration: 3.6, animate: { scale: [0.4, 1.1, 1, 1, 0.9], y: [20, 0, 0, 0, -6], opacity: [0, 1, 1, 1, 0] } }));
    case "colours":
      return Array.from({ length: 18 }, (_, i) => ({ color: ["#ff8fab", "#6fb6ff", "#ffd166", "#5fd3a4", "#b48cff", "#ffb454"][i % 6], left: 50, top: 45, size: 26 + (i % 4) * 10, delay: (i % 6) * 0.05, duration: 1.8, animate: { x: [0, Math.cos((i / 18) * Math.PI * 2) * (90 + (i % 3) * 50)], y: [0, Math.sin((i / 18) * Math.PI * 2) * (90 + (i % 3) * 50) + 60], scale: [0.2, 1.4, 1.2], opacity: [0, 0.9, 0] } }));
    case "fireworks":
      return Array.from({ length: 18 }, (_, i) => {
        const burst = Math.floor(i / 6);
        const angle = ((i % 6) / 6) * Math.PI * 2 + burst;
        return { color: ["#ffd166", "#ff8fab", "#6fb6ff"][burst]!, left: [30, 65, 50][burst]!, top: [30, 24, 44][burst]!, size: 10, delay: burst * 0.5, duration: 1.6, animate: { x: [0, Math.cos(angle) * 110], y: [0, Math.sin(angle) * 110 + 30], scale: [0.4, 1, 0.2], opacity: [0, 1, 0] } };
      });
    case "kites":
      return Array.from({ length: 6 }, (_, i) => ({ glyph: "🪁", left: 5 + i * 16, top: 90, size: 30 + (i % 3) * 8, delay: i * 0.35, duration: 4.5, animate: { y: [0, -700], x: [0, (i % 2 ? 1 : -1) * 40, 0, (i % 2 ? -1 : 1) * 30], rotate: [-10, 10, -10], opacity: [0, 1, 1, 0] } }));
    case "flowers":
      return Array.from({ length: 18 }, (_, i) => ({ glyph: ["🌸", "🌼", "🌺"][i % 3]!, left: spread(i, 37, 2, 96), top: -6, size: 18 + (i % 3) * 6, delay: (i % 9) * 0.3, duration: 4 + (i % 2), animate: { y: [0, 800], x: [0, (i % 2 ? 1 : -1) * 40, 0], rotate: [0, (i % 2 ? 1 : -1) * 360], opacity: [0, 1, 1, 0] } }));
  }
}

/** A festival's one-shot effect; keyed on `burst` so each change re-fires (0 = nothing). Reduced motion: one calm fade instead. */
export function FestivalEffect({ effect, burst }: { effect: Effect; burst: number }) {
  const reduced = useReducedMotion() ?? false;
  if (effect === "confetti" && !reduced) return <Confetti burst={burst} />;
  const list = effect === "confetti" ? [] : particles(effect);
  const glyph = { diyas: "🪔", colours: "🎨", snow: "❄️", fireworks: "🎆", kites: "🪁", flowers: "🌸", confetti: "🎊" }[effect];
  return (
    <Portal>
      <AnimatePresence>
        {burst > 0 && (
          <div key={burst} className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: Z.confetti }} aria-hidden>
            {reduced ? (
              <m.span className="absolute top-[40%] left-1/2 -ml-[0.5em] leading-none" style={{ fontSize: 64 }} initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ duration: 2.2, times: [0, 0.2, 0.7, 1] }}>
                {glyph}
              </m.span>
            ) : (
              list.map((p, i) => (
                <m.span
                  key={i}
                  className="absolute block leading-none"
                  style={{ left: `${p.left}%`, top: `${p.top}%`, fontSize: p.glyph ? p.size : undefined, width: p.color ? p.size : undefined, height: p.color ? p.size : undefined, borderRadius: p.color ? "50%" : undefined, background: p.color }}
                  initial={{ opacity: 0 }}
                  animate={p.animate}
                  transition={{ duration: p.duration, delay: p.delay, ease: "easeOut" }}
                >
                  {p.glyph}
                </m.span>
              ))
            )}
          </div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
