import { Check, CheckCheck, Clock } from "lucide-react";

import { cn } from "@/lib/cn";
import type { MessageStatus } from "@/lib/types";

/** ✓ sent · ✓✓ delivered · ✓✓ (accent) read · clock while the write is pending. */
export function Ticks({ status, pending, className }: { status: MessageStatus; pending: boolean; className?: string }) {
  if (pending) return <Clock size={13} aria-label="Sending" className={cn("text-muted", className)} />;
  if (status === "sent") return <Check size={14} aria-label="Sent" className={cn("text-muted", className)} />;
  return (
    <CheckCheck
      size={14}
      aria-label={status === "read" ? "Read" : "Delivered"}
      className={cn(status === "read" ? "text-[var(--accent)]" : "text-muted", className)}
      strokeWidth={status === "read" ? 2.6 : 2}
    />
  );
}
