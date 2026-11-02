"use client";

import { Eye } from "lucide-react";

import { cn } from "@/lib/cn";

/**
 * The 👁️ view-once button (phase 27, placed by the "view-once toggle placement"
 * chore): rendered only inside an attachment preview — next to the picked
 * photos, or next to the recorded voice note — so a text-only composer never
 * shows it. Off by default; on, it fills and grows a short "View once" label.
 */
export function ViewOnceToggle({ on, onToggle, what }: { on: boolean; onToggle: () => void; what: "photo" | "voice note" }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      aria-label={on ? `View once is on for this ${what}` : `Send this ${what} as view once`}
      data-testid="view-once-toggle"
      className={cn(
        "tap flex h-9 shrink-0 items-center gap-1 rounded-full border px-2 text-[11px] font-bold",
        on ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-border bg-surface text-muted",
      )}
    >
      <Eye size={15} aria-hidden />
      {on && <span>View once</span>}
    </button>
  );
}
