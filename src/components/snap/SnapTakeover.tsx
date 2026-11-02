"use client";

import { m } from "framer-motion";
import { useState } from "react";

import { SnapCapture } from "@/components/snap/SnapCapture";
import { Portal, Z } from "@/components/ui/Portal";
import { useNow } from "@/hooks/useNow";
import { formatCountdown, SNAP_WINDOW_MS, snapWindowLeftMs } from "@/lib/snap";
import type { SnapEntryDoc } from "@/lib/types";

interface SnapTakeoverProps {
  today: string;
  uid: string;
  friendName: string;
  friendPosted: boolean;
  onPosted: (entry: SnapEntryDoc) => void;
  onDismiss: () => void;
}

/**
 * The full-screen prompt that greets an open (or resume) once today's minute
 * has come and my snap isn't in: a two-minute countdown from the moment it
 * appears (posting inside it is `onTime`, after it `later`), the capture UI,
 * and "Not now", which leaves the Home card's button for the rest of the day.
 */
export function SnapTakeover({ today, uid, friendName, friendPosted, onPosted, onDismiss }: SnapTakeoverProps) {
  const [deadline] = useState(() => Date.now() + SNAP_WINDOW_MS);
  const now = useNow(1000).getTime();
  const left = snapWindowLeftMs(deadline, now);
  return (
    <Portal>
      <m.div role="dialog" aria-modal="true" aria-label="Snap time" className="fixed inset-0 mx-auto flex w-full max-w-[480px] flex-col overflow-y-auto bg-bg px-4 pt-[max(env(safe-area-inset-top),16px)] pb-[max(env(safe-area-inset-bottom),16px)]" style={{ zIndex: Z.viewer }} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}>
        <div className="flex items-center gap-3 px-1 pb-3">
          <span className="text-4xl" aria-hidden>
            📸
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-2xl font-semibold leading-tight">Snap time!</h1>
            <p className="text-sm text-muted tabular-nums">{left > 0 ? `${formatCountdown(left)} to post it on time` : "Post it anyway — it'll be marked later"}</p>
          </div>
          <button type="button" onClick={onDismiss} className="tap rounded-full bg-surface-2 px-3 py-2 text-sm font-bold text-muted">
            Not now
          </button>
        </div>
        <SnapCapture today={today} uid={uid} friendName={friendName} friendPosted={friendPosted} deadline={deadline} onPosted={onPosted} />
      </m.div>
    </Portal>
  );
}
