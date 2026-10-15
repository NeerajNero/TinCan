"use client";

import { format } from "date-fns";
import { onSnapshot, type QueryDocumentSnapshot } from "@/lib/firebase/fs";
import { AnimatePresence, motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { cancelScheduled, pendingScheduled, scheduleMessage } from "@/lib/db/scheduled";
import type { ScheduledDoc } from "@/lib/types";

interface Pending extends ScheduledDoc {
  id: string;
}
const mapDoc = (d: QueryDocumentSnapshot<ScheduledDoc>): Pending => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) });

function toLocalInputValue(date: Date) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface ScheduleSheetProps {
  open: boolean;
  uid: string;
  /** Text currently in the composer, offered as the default. */
  draft: string;
  onClose: () => void;
  onScheduled: () => void;
}

/** Bottom sheet: schedule a text for later, and see/cancel pending ones. Delivery is the tick job's. */
export function ScheduleSheet(props: ScheduleSheetProps) {
  return (
    <AnimatePresence>
      {props.open && <SheetBody key="sheet" {...props} />}
    </AnimatePresence>
  );
}

/** Mounted fresh each time the sheet opens, so the draft and clock start clean. */
function SheetBody({ uid, draft, onClose, onScheduled }: ScheduleSheetProps) {
  const [openedAt] = useState(() => Date.now());
  const [pending, setPending] = useState<Pending[]>([]);
  const [text, setText] = useState(draft);
  const [when, setWhen] = useState(() => toLocalInputValue(new Date(openedAt + 60 * 60 * 1000)));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(pendingScheduled(uid), (snap) => setPending(snap.docs.map(mapDoc).sort((a, b) => a.sendAt.toMillis() - b.sendAt.toMillis())));
    return () => unsub();
  }, [uid]);

  const sendAt = when ? new Date(when) : null;
  const inFuture = sendAt !== null && !Number.isNaN(sendAt.getTime()) && sendAt.getTime() > openedAt + 60_000;
  const canSave = text.trim().length > 0 && inFuture && !busy;

  async function save() {
    if (!canSave || !sendAt) return;
    setBusy(true);
    try {
      await scheduleMessage(uid, text, sendAt);
      setText("");
      onScheduled();
    } finally {
      setBusy(false);
    }
  }

  return (
        <>
          <motion.button key="backdrop" type="button" aria-label="Close" onClick={onClose} className="fixed inset-0 z-40 bg-black/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div
            key="sheet"
            role="dialog"
            aria-label="Scheduled messages"
            className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85dvh] w-full max-w-[480px] flex-col gap-3 overflow-y-auto rounded-t-[28px] bg-surface p-4 pb-[max(env(safe-area-inset-bottom),16px)] shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.3)]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
          >
            <div className="mx-auto h-1.5 w-10 rounded-full bg-border" aria-hidden />
            <h2 className="text-lg font-semibold">Send later ⏰</h2>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 2000))}
              placeholder="What should arrive later?"
              rows={3}
              aria-label="Message"
              className="w-full resize-none rounded-2xl border border-border bg-surface-2 px-4 py-3 text-[15px] focus:border-[var(--accent)] focus:outline-none"
            />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sched-when">When</Label>
              <Input id="sched-when" type="datetime-local" value={when} min={toLocalInputValue(new Date(openedAt))} onChange={(e) => setWhen(e.target.value)} />
              {!inFuture && when && <p className="text-xs text-muted">Pick a time at least a minute from now.</p>}
            </div>
            <p className="text-xs text-muted">Delivered within about 15 minutes of that time, as if you&apos;d sent it then.</p>
            <Button onClick={save} disabled={!canSave} className="self-end px-5">
              {busy ? "Scheduling…" : "Schedule"}
            </Button>

            <h3 className="mt-2 text-sm font-bold uppercase tracking-wide text-muted">Pending</h3>
            {pending.length === 0 && <p className="text-sm text-muted">Nothing scheduled.</p>}
            {pending.map((p) => (
              <div key={p.id} className="flex items-start gap-3 rounded-2xl bg-surface-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm">{p.text}</p>
                  <p className="text-xs text-muted">{format(p.sendAt.toDate(), "EEE d MMM, h:mm a")}</p>
                </div>
                <button type="button" onClick={() => void cancelScheduled(p.id)} aria-label="Cancel scheduled message" className="tap grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </motion.div>
        </>
  );
}
