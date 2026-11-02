"use client";

import { Eye } from "lucide-react";

import { cn } from "@/lib/cn";

/**
 * The 👁️ view-once button (phase 27, placed by the "view-once toggle placement"
 * chore): rendered only inside an attachment preview — next to the picked
 * photos, or next to the recorded voice note — so a text-only composer never
 * shows it. Off by default; on, it fills with the accent colour. Icon only in
 * both states (the label lives in the accessible name and the tooltip).
 */
export function ViewOnceToggle({ on, onToggle, what }: { on: boolean; onToggle: () => void; what: "photo" | "voice note" }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      aria-label={on ? `View once is on for this ${what}` : `Send this ${what} as view once`}
      title={on ? "View once: on" : "View once"}
      data-testid="view-once-toggle"
      className={cn(
        "tap grid size-9 shrink-0 place-items-center rounded-full border",
        on ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-border bg-surface text-muted",
      )}
    >
      <Eye size={16} aria-hidden />
    </button>
  );
}
