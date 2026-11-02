"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/cn";
import { isDateKey } from "@/lib/dates";
import { addEvent, deleteEvent, editEvent, type EventContext } from "@/lib/db/events";
import { errorMessage } from "@/lib/swallow";
import { EVENT_BOTH } from "@/lib/types";
import { EVENT_EMOJI, EVENT_NOTE_MAX, EVENT_TITLE_MAX, type EventWithId } from "@/lib/upcoming";

interface EventEditorProps {
  open: boolean;
  onClose: () => void;
  uid: string;
  friendUid: string | null;
  friendName: string;
  /** The event being edited, or null for a new one. */
  event: EventWithId | null;
  /** The day a new event starts on. */
  defaultDate: string;
  ctx: EventContext;
}

/** Add / edit an upcoming event (phase 29). Either person may edit or delete any event. */
export function EventEditor({ open, onClose, uid, friendUid, friendName, event, defaultDate, ctx }: EventEditorProps) {
  return (
    <Sheet open={open} onClose={onClose} label={event ? "Edit event" : "Add event"} className="flex flex-col gap-3 px-5">
      <Form uid={uid} friendUid={friendUid} friendName={friendName} event={event} defaultDate={defaultDate} ctx={ctx} onClose={onClose} />
    </Sheet>
  );
}

function Form({ uid, friendUid, friendName, event, defaultDate, ctx, onClose }: Omit<EventEditorProps, "open">) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [emoji, setEmoji] = useState(event?.emoji ?? "📅");
  const [date, setDate] = useState(event?.date ?? defaultDate);
  const [multi, setMulti] = useState(Boolean(event?.endDate));
  const [endDate, setEndDate] = useState(event?.endDate ?? "");
  const [time, setTime] = useState(event?.time ?? "");
  const [who, setWho] = useState(event?.who ?? EVENT_BOTH);
  const [note, setNote] = useState(event?.note ?? "");
  const [countdown, setCountdown] = useState(event?.countdown ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = title.trim().length > 0 && isDateKey(date) && (!multi || !endDate || (isDateKey(endDate) && endDate >= date));

  async function save() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const input = { title, emoji, date, endDate: multi && endDate ? endDate : undefined, time: time || undefined, who, note, countdown };
    try {
      if (event) await editEvent(event.id, input, ctx);
      else await addEvent(uid, input, ctx);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!event || busy) return;
    setBusy(true);
    try {
      await deleteEvent(event.id, ctx);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const whoChip = (value: string, label: string) => (
    <button type="button" key={value} onClick={() => setWho(value)} aria-pressed={who === value} className={cn("tap rounded-full border px-3 py-1.5 text-sm font-semibold", who === value ? "border-[var(--accent)] bg-accent-soft" : "border-border text-muted")}>
      {label}
    </button>
  );

  return (
    <>
      <h2 className="font-heading text-xl font-semibold">{event ? "Edit event" : "Add to Upcoming"}</h2>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Emoji">
        {EVENT_EMOJI.map((e) => (
          <button type="button" key={e} onClick={() => setEmoji(e)} aria-pressed={emoji === e} aria-label={`Emoji ${e}`} className={cn("tap grid size-10 place-items-center rounded-full text-xl", emoji === e ? "bg-accent-soft ring-2 ring-[var(--accent)]" : "bg-surface-2")}>
            {e}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="ev-title">What</Label>
        <Input id="ev-title" value={title} maxLength={EVENT_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="Exam, flight, dinner…" autoFocus={!event} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="ev-date">{multi ? "From" : "When"}</Label>
          <Input id="ev-date" type="date" value={date} max="9999-12-31" onChange={(e) => setDate(e.target.value)} />
        </div>
        {multi ? (
          <div className="flex flex-col gap-1">
            <Label htmlFor="ev-end">To</Label>
            <Input id="ev-end" type="date" value={endDate} min={date || undefined} max="9999-12-31" onChange={(e) => setEndDate(e.target.value)} />
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <Label htmlFor="ev-time">Time (optional)</Label>
            <Input id="ev-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        )}
      </div>
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>More than one day</span>
        <Switch
          checked={multi}
          onChange={(v) => {
            setMulti(v);
            if (v) setTime("");
            else setEndDate("");
          }}
          aria-label="More than one day"
        />
      </label>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold text-muted uppercase">Who</span>
        <div className="flex flex-wrap gap-1.5">
          {whoChip(uid, "Me")}
          {friendUid && whoChip(friendUid, friendName)}
          {whoChip(EVENT_BOTH, "Both of us")}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="ev-note">Note (optional)</Label>
        <Input id="ev-note" value={note} maxLength={EVENT_NOTE_MAX} onChange={(e) => setNote(e.target.value)} placeholder="Anything worth remembering" />
      </div>
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>
          <span className="block font-semibold">Count down to this ⏳</span>
          <span className="block text-xs text-muted">Shows on Plan&apos;s hero and Home when it&apos;s the nearest thing</span>
        </span>
        <Switch checked={countdown} onChange={setCountdown} aria-label="Count down to this" />
      </label>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="mt-1 flex items-center gap-2">
        {event && (
          <Button variant="ghost" onClick={remove} disabled={busy} className="text-red-500">
            Delete
          </Button>
        )}
        <Button onClick={save} disabled={!valid || busy} className="ml-auto px-6">
          {busy ? "Saving…" : event ? "Save" : "Add"}
        </Button>
      </div>
    </>
  );
}
