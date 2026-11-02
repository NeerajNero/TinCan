"use client";

import { Bell } from "lucide-react";
import { useState } from "react";

import { InboxSheet } from "@/components/shell/InboxSheet";
import { usePair } from "@/hooks/usePair";
import { cn } from "@/lib/cn";
import { markInboxRead } from "@/lib/db/inbox";
import { formatBadge, inboxUnread } from "@/lib/inbox";
import { swallow } from "@/lib/swallow";

/**
 * The bell on every tab header (phase 28): the unread badge rides on the
 * `users/{me}` listener the app already holds, so it costs nothing. Opening
 * the sheet zeroes the count and stamps `lastReadAt`; rows newer than the
 * stamp the sheet opened with keep an unread dot until "Mark all read".
 */
export function InboxBell({ className }: { className?: string }) {
  const { uid, me } = usePair();
  const [open, setOpen] = useState(false);
  const [since, setSince] = useState<number | null>(null);
  const unread = inboxUnread(me);
  const badge = formatBadge(unread);

  function show() {
    setSince(me.inbox?.lastReadAt?.toMillis() ?? 0);
    setOpen(true);
    // Nothing arrived since the last read when the count is zero: no write.
    if (unread > 0) markInboxRead(uid).catch(swallow);
  }
  function markAll() {
    setSince(Date.now());
    markInboxRead(uid).catch(swallow);
  }

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-label={badge ? `Notifications, ${unread} unread` : "Notifications"}
        className={cn("tap relative grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2", className)}
      >
        <Bell size={20} />
        {badge && (
          <span data-testid="inbox-badge" className="absolute top-0.5 right-0 min-w-[18px] rounded-full bg-accent px-1 text-center text-[11px] leading-[18px] font-bold text-accent-ink">
            {badge}
          </span>
        )}
      </button>
      <InboxSheet open={open} uid={uid} since={since ?? 0} onClose={() => setOpen(false)} onMarkAll={markAll} />
    </>
  );
}
