"use client";

import { AnimatePresence, m } from "framer-motion";

import { GAME_REACTIONS, type LiveReaction } from "@/lib/reactions";

/** The floating emoji over the board: one element per push id, entered once, gone after its animation. */
export function ReactionBurst({ live, uid, nameOf }: { live: LiveReaction[]; uid: string; nameOf: (uid: string) => string }) {
  return (
    <AnimatePresence>
      {live.map((r) => (
        <m.div
          key={r.id}
          aria-live="polite"
          className="pointer-events-none absolute top-1/3 z-20 flex flex-col items-center"
          style={{ left: `${15 + r.lane * 70}%`, x: "-50%" }}
          initial={{ scale: 0.4, opacity: 0, y: 20 }}
          animate={{ scale: [0.4, 1.4, 1.1], opacity: [0, 1, 1], y: [20, -10, -40] }}
          exit={{ opacity: 0, y: -80 }}
          transition={{ duration: 0.9, ease: "easeOut", times: [0, 0.4, 1] }}
        >
          <span className="text-7xl drop-shadow-lg">{r.emoji}</span>
          <span className="mt-1 rounded-full bg-surface/90 px-2 py-0.5 text-xs font-bold shadow">{r.by === uid ? "You" : nameOf(r.by)}</span>
        </m.div>
      ))}
    </AnimatePresence>
  );
}

/** The four buttons. One `onClick` each (the browser's single activation event for touch, pen and mouse); no pointer or touch handler beside it. */
export function ReactionRow({ onReact }: { onReact: (emoji: string) => void }) {
  return (
    <div role="group" aria-label="React" className="flex justify-center gap-2">
      {GAME_REACTIONS.map((e) => (
        <m.button key={e} type="button" whileTap={{ scale: 0.8 }} onClick={() => onReact(e)} aria-label={`React ${e}`} className="tap grid size-11 place-items-center rounded-full bg-surface text-2xl shadow-sm">
          {e}
        </m.button>
      ))}
    </div>
  );
}
