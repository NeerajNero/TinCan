"use client";

import { format } from "date-fns";
import { onSnapshot, type QueryDocumentSnapshot } from "firebase/firestore";
import { Reorder } from "framer-motion";
import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { useNow } from "@/hooks/useNow";
import { usePair } from "@/hooks/usePair";
import { cn } from "@/lib/cn";
import { dateKeyToLocalDate, daysBetween, isDateKey, roomDateKey } from "@/lib/dates";
import { addTrip, cleanStop, deleteTrip, editTrip, newStopId, saveDays, tripsQuery, type TripInput } from "@/lib/db/trips";
import type { TripDay, TripDoc, TripStop } from "@/lib/types";

interface Trip extends TripDoc {
  id: string;
}
const mapDoc = (d: QueryDocumentSnapshot<TripDoc>): Trip => ({ id: d.id, ...d.data() });

export function TripsScreen() {
  const { pair } = usePair();
  const now = useNow(60_000);
  const today = roomDateKey(pair, now);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState<Trip | "new" | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(tripsQuery(), (snap) => {
      setTrips(snap.docs.map(mapDoc));
      setReady(true);
    });
    return () => unsub();
  }, []);

  const upcoming = useMemo(() => trips.filter((t) => daysBetween(today, t.endDate) >= 0), [trips, today]);
  const past = useMemo(() => trips.filter((t) => daysBetween(today, t.endDate) < 0).reverse(), [trips, today]);

  return (
    <div className="flex flex-col gap-4">
      <SubHeader
        emoji="🧳"
        title="Trips"
        back="/plan"
        action={
          form === null ? (
            <Button onClick={() => setForm("new")} className="px-4 py-2 text-sm">
              Add
            </Button>
          ) : null
        }
      />
      {form !== null && <TripForm key={form === "new" ? "new" : form.id} trip={form === "new" ? null : form} onDone={() => setForm(null)} />}
      {ready && trips.length === 0 && form === null && <Card className="py-8 text-center text-muted">No trips yet. Plan the next one?</Card>}

      {upcoming.map((t) => (
        <TripCard key={t.id} trip={t} today={today} open={open === t.id} onToggle={() => setOpen(open === t.id ? null : t.id)} onEdit={() => setForm(t)} />
      ))}

      {past.length > 0 && (
        <div className="flex flex-col gap-3">
          <button type="button" onClick={() => setShowPast((v) => !v)} aria-expanded={showPast} className="tap flex items-center gap-2 px-2 text-sm font-bold text-muted">
            <ChevronDown size={16} className={cn("transition-transform", showPast && "rotate-180")} />
            {past.length} past {past.length === 1 ? "trip" : "trips"}
          </button>
          {showPast && past.map((t) => <TripCard key={t.id} trip={t} today={today} open={open === t.id} onToggle={() => setOpen(open === t.id ? null : t.id)} onEdit={() => setForm(t)} past />)}
        </div>
      )}
    </div>
  );
}

function TripCard({ trip, today, open, onToggle, onEdit, past }: { trip: Trip; today: string; open: boolean; onToggle: () => void; onEdit: () => void; past?: boolean }) {
  const days = daysBetween(today, trip.startDate);
  const badge = past ? "Done" : days > 0 ? `${days}d to go` : days === 0 ? "Today!" : "Ongoing";
  return (
    <Card className={cn("flex flex-col gap-3", past && "opacity-70")}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 text-left">
        <span className="text-3xl" aria-hidden>
          🧳
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-heading text-lg font-semibold leading-tight">{trip.title}</span>
          <span className="block text-xs text-muted">
            {trip.place && `${trip.place} · `}
            {format(dateKeyToLocalDate(trip.startDate), "d MMM")} – {format(dateKeyToLocalDate(trip.endDate), "d MMM yyyy")} · {trip.days.length} {trip.days.length === 1 ? "day" : "days"}
          </span>
        </span>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", past ? "bg-surface-2 text-muted" : "bg-accent-soft")}>{badge}</span>
        <ChevronDown size={18} className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="flex justify-end gap-1 -mt-1">
            <button type="button" onClick={onEdit} aria-label="Edit trip" className="tap grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2">
              <Pencil size={16} />
            </button>
            <button type="button" onClick={() => void deleteTrip(trip.id)} aria-label="Delete trip" className="tap grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2">
              <Trash2 size={16} />
            </button>
          </div>
          {trip.days.map((day, i) => (
            <DaySection key={day.date} trip={trip} index={i} day={day} />
          ))}
        </>
      )}
    </Card>
  );
}

function DaySection({ trip, index, day }: { trip: Trip; index: number; day: TripDay }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TripStop | null>(null);

  function write(stops: TripStop[]) {
    const days = trip.days.map((d, i) => (i === index ? { ...d, stops } : d));
    void saveDays(trip.id, days);
  }
  function reorder(ids: string[]) {
    write(ids.map((id) => day.stops.find((s) => s.id === id)).filter((s): s is TripStop => Boolean(s)));
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">
          Day {index + 1} <span className="font-normal text-muted">· {format(dateKeyToLocalDate(day.date), "EEE d MMM")}</span>
        </p>
        <button type="button" onClick={() => setAdding(true)} aria-label="Add stop" className="tap grid size-9 place-items-center rounded-full bg-surface text-muted">
          <Plus size={16} />
        </button>
      </div>
      {day.stops.length === 0 && !adding && <p className="text-xs text-muted">Nothing planned yet.</p>}
      <Reorder.Group axis="y" values={day.stops.map((s) => s.id)} onReorder={reorder} className="flex flex-col gap-1.5">
        {day.stops.map((s) =>
          editing?.id === s.id ? (
            <StopForm key={s.id} initial={s} onCancel={() => setEditing(null)} onSave={(stop) => { write(day.stops.map((x) => (x.id === s.id ? stop : x))); setEditing(null); }} />
          ) : (
            <Reorder.Item key={s.id} value={s.id} className="flex items-center gap-2 rounded-xl bg-surface px-2 py-1.5">
              <span className="w-12 shrink-0 text-xs font-bold tabular-nums text-muted">{s.time || "—"}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm">{s.name}</span>
                {s.note && <span className="block truncate text-xs text-muted">{s.note}</span>}
              </span>
              <button type="button" onClick={() => setEditing(s)} aria-label="Edit stop" className="tap grid size-8 place-items-center rounded-full text-muted">
                <Pencil size={13} />
              </button>
              <button type="button" onClick={() => write(day.stops.filter((x) => x.id !== s.id))} aria-label="Delete stop" className="tap grid size-8 place-items-center rounded-full text-muted">
                <Trash2 size={13} />
              </button>
            </Reorder.Item>
          ),
        )}
      </Reorder.Group>
      {adding && <StopForm onCancel={() => setAdding(false)} onSave={(stop) => { write([...day.stops, stop]); setAdding(false); }} />}
    </div>
  );
}

function StopForm({ initial, onSave, onCancel }: { initial?: TripStop; onSave: (stop: TripStop) => void; onCancel: () => void }) {
  const [time, setTime] = useState(initial?.time ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  return (
    <form
      className="flex flex-col gap-2 rounded-xl bg-surface p-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave(cleanStop({ id: initial?.id ?? newStopId(), time, name, note }));
      }}
    >
      <div className="flex gap-2">
        <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time" className="w-32" />
        <Input value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} placeholder="Where / what" aria-label="Stop" autoFocus />
      </div>
      <Input value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} placeholder="Note (optional)" aria-label="Note" />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} className="py-2 text-sm">
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim()} className="px-4 py-2 text-sm">
          {initial ? "Save" : "Add"}
        </Button>
      </div>
    </form>
  );
}

function TripForm({ trip, onDone }: { trip: Trip | null; onDone: () => void }) {
  const [title, setTitle] = useState(trip?.title ?? "");
  const [place, setPlace] = useState(trip?.place ?? "");
  const [startDate, setStart] = useState(trip?.startDate ?? "");
  const [endDate, setEnd] = useState(trip?.endDate ?? "");
  const [busy, setBusy] = useState(false);
  const valid = title.trim().length > 0 && isDateKey(startDate) && isDateKey(endDate) && daysBetween(startDate, endDate) >= 0 && daysBetween(startDate, endDate) <= 60;

  async function save() {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const input: TripInput = { title, place, startDate, endDate };
      if (trip) await editTrip(trip.id, input, trip.days);
      else await addTrip(input);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <Input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 80))} placeholder="Trip name" aria-label="Title" autoFocus />
      <Input value={place} onChange={(e) => setPlace(e.target.value.slice(0, 80))} placeholder="Where (optional)" aria-label="Place" />
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="trip-start">From</Label>
          <Input id="trip-start" type="date" value={startDate} max="9999-12-31" onChange={(e) => { setStart(e.target.value); if (!endDate || e.target.value > endDate) setEnd(e.target.value); }} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="trip-end">To</Label>
          <Input id="trip-end" type="date" value={endDate} min={startDate || undefined} max="9999-12-31" onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
      {startDate && endDate && daysBetween(startDate, endDate) > 60 && <p className="text-xs text-muted">Keep it to 60 days or fewer.</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={save} disabled={!valid || busy} className="px-5">
          {busy ? "Saving…" : trip ? "Save" : "Add trip"}
        </Button>
      </div>
    </Card>
  );
}
