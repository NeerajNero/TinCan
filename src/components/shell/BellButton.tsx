"use client";

import { Bell } from "lucide-react";

import { cn } from "@/lib/cn";
import { formatBadge } from "@/lib/inbox";

/** The bell with its badge: a fixed 44 px box whose badge is absolutely positioned, so a count change never moves anything. */
export function BellButton({ unread, onClick, className }: { unread: number; onClick: () => void; className?: string }) {
  const badge = formatBadge(unread);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={badge ? `Notifications, ${unread} unread` : "Notifications"}
      data-header-bell
      className={cn("tap relative grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2", className)}
    >
      <Bell size={20} />
      {badge && (
        <span data-testid="inbox-badge" className="absolute top-0.5 right-0 min-w-[18px] rounded-full bg-accent px-1 text-center text-[11px] leading-[18px] font-bold text-accent-ink">
          {badge}
        </span>
      )}
    </button>
  );
}
