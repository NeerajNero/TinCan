"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";

import type { IncomingPing } from "@/hooks/useIncomingPings";
import { PINGS, type PingKind } from "@/lib/types";

const PARTICLES: Record<PingKind, string[]> = {
  thinking: ["💭", "💗", "✨", "💭", "💕", "✨"],
  hug: ["🤗", "💞", "🧸", "💖", "🤗", "💝"],
  highfive: ["✋", "⚡", "🎉", "✨", "🙌", "⭐"],
  wave: ["👋", "🌊", "😊", "👋", "✨", "💙"],
};

interface PingOverlayProps {
  ping: IncomingPing | null;
  fromName: string;
  onDone: () => void;
}

/** Full-screen bounce when a ping lands; tap anywhere or wait 2.4 s to dismiss. */
export function PingOverlay({ ping, fromName, onDone }: PingOverlayProps) {
  useEffect(() => {
    if (!ping) return;
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [ping, onDone]);

  return (
    <AnimatePresence>
      {ping && (
        <motion.button
          key={ping.nonce}
          type="button"
          aria-label="Dismiss"
          onClick={onDone}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-bg/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {PARTICLES[ping.kind].map((p, i) => {
            const angle = (i / PARTICLES[ping.kind].length) * Math.PI * 2;
            return (
              <motion.span
                key={i}
                aria-hidden
                className="absolute text-3xl"
                initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                animate={{
                  x: Math.cos(angle) * 130,
                  y: Math.sin(angle) * 130,
                  scale: [0, 1.2, 1],
                  opacity: [0, 1, 0.9],
                }}
                transition={{ delay: 0.15 + i * 0.04, type: "spring", stiffness: 180, damping: 14 }}
              >
                {p}
              </motion.span>
            );
          })}
          <motion.span
            aria-hidden
            className="text-9xl"
            initial={{ scale: 0, rotate: -20 }}
            animate={
              ping.kind === "wave"
                ? { scale: 1, rotate: [0, 20, -10, 20, 0] }
                : ping.kind === "hug"
                  ? { scale: [0, 1.3, 1], rotate: 0 }
                  : { scale: [0, 1.2, 1], rotate: 0 }
            }
            transition={{ type: "spring", stiffness: 260, damping: 14, duration: 0.9 }}
          >
            {PINGS[ping.kind].emoji}
          </motion.span>
          <motion.p
            className="font-heading text-2xl font-semibold"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            {fromName} {PINGS[ping.kind].sentence}
          </motion.p>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
