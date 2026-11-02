"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import { isDateKey } from "@/lib/dates";
import { markBusy, type EventContext } from "@/lib/db/events";
import { errorMessage } from "@/lib/swallow";

interface MarkBusySheetProps {
  open: boolean;
  onClose: () => void;
  uid: string;
  today: string;
  ctx: EventContext;
}

/** "Mark busy": an all-day "Busy" event for me over a date range, one tap after picking the days. */
export function MarkBusySheet({ open, onClose, uid, today, ctx }: MarkBusySheetProps) {
  return (
    <Sheet open={open} onClose={onClose} label="Mark busy" className="flex flex-col gap-3 px-5">
      <Form uid={uid} today={today} ctx={ctx} onClose={onClose} />
    </Sheet>
  );
}

function Form({ uid, today, ctx, onClose }: Omit<MarkBusySheetProps, "open">) {
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = isDateKey(start) && isDateKey(end);

  async function save() {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await markBusy(uid, start, end, ctx);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className="font-heading text-xl font-semibold">⛔ Mark busy</h2>
      <p className="text-sm text-muted">An all-day &ldquo;Busy&rdquo; for you on these days, so your friend knows not to plan anything.</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="busy-from">From</Label>
          <Input id="busy-from" type="date" value={start} max="9999-12-31" onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="busy-to">To</Label>
          <Input id="busy-to" type="date" value={end} min={start || undefined} max="9999-12-31" onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button onClick={save} disabled={!valid || busy} className="self-end px-6">
        {busy ? "Saving…" : "Mark busy"}
      </Button>
    </>
  );
}
