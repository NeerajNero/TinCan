"use client";

import { m } from "framer-motion";

import { cn } from "@/lib/cn";

/** Full-screen loader. `inline` fills the shell's main area instead (screens inside the tab layout). */
export function Splash({ label = "Untangling the string…", inline = false }: { label?: string; inline?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex flex-col items-center justify-center-safe gap-4", inline ? "min-h-0 flex-1" : "screen-fixed safe-top safe-bottom")}
    >
      <m.div
        aria-hidden
        className="text-6xl"
        animate={{ y: [0, -10, 0], rotate: [0, -6, 6, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      >
        🥫
      </m.div>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}
