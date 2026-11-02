"use client";

import { useState } from "react";

import { BellButton } from "@/components/shell/BellButton";
import { InboxSheet } from "@/components/shell/InboxSheet";
import { usePair } from "@/hooks/usePair";
import { markInboxRead } from "@/lib/db/inbox";
import { inboxUnread } from "@/lib/inbox";
import { swallow } from "@/lib/swallow";

/**
 * The bell in the persistent header (phase 28): the unread badge rides on the
 * `users/{me}` listener the app already holds, so it costs nothing. Opening
 * the sheet zeroes the count and stamps `lastReadAt`; rows newer than the
 * stamp the sheet opened with keep an unread dot until "Mark all read".
 */
export function InboxBell({ className }: { className?: string }) {
  const { uid, me } = usePair();
  const [open, setOpen] = useState(false);
  const [since, setSince] = useState<number | null>(null);
  const unread = inboxUnread(me);

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
      <BellButton unread={unread} onClick={show} className={className} />
      <InboxSheet open={open} uid={uid} since={since ?? 0} onClose={() => setOpen(false)} onMarkAll={markAll} />
    </>
  );
}
