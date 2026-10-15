"use client";

import { motion } from "framer-motion";

export function Splash({ label = "Untangling the string…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-dvh flex-col items-center justify-center gap-4 safe-top safe-bottom"
    >
      <motion.div
        aria-hidden
        className="text-6xl"
        animate={{ y: [0, -10, 0], rotate: [0, -6, 6, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      >
        🥫
      </motion.div>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}
