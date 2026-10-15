"use client";

import { format } from "date-fns";
import { onSnapshot, type QueryDocumentSnapshot } from "firebase/firestore";
import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { useNow } from "@/hooks/useNow";
import { usePair } from "@/hooks/usePair";
import { cn } from "@/lib/cn";
import { dateKeyToLocalDate, isDateKey, roomDateKey } from "@/lib/dates";
import { addMilestone, deleteMilestone, editMilestone, milestonesQuery, type MilestoneInput } from "@/lib/db/milestones";
import { friendsSinceMilestone, sortUpcoming, toUpcoming, type Upcoming } from "@/lib/milestones";
import type { MilestoneDoc } from "@/lib/types";

interface Row extends MilestoneDoc {
  id: string;
}
const mapDoc = (d: QueryDocumentSnapshot<MilestoneDoc>): Row => ({ id: d.id, ...d.data() });
const EMOJI = ["🎉", "🎂", "🧵", "✈️", "💖", "🎓", "🏠", "🌟", "🍰", "🎁"];

export function MilestonesScreen() {
  const { pair } = usePair();
  const now = useNow(60_000);
  const today = roomDateKey(pair, now);
  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<Row | "new" | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(milestonesQuery(), (snap) => setRows(snap.docs.map(mapDoc)));
    return () => unsub();
  }, []);

  const list = useMemo<Upcoming[]>(() => {
    const items = rows.map((r) => toUpcoming({ id: r.id, title: r.title, emoji: r.emoji, date: r.date, repeatYearly: r.repeatYearly }, today));
    const fs = friendsSinceMilestone(pair.friendsSince);
    if (fs) items.push(toUpcoming(fs, today, true));
    return sortUpcoming(items);
  }, [rows, pair.friendsSince, today]);

  return (
    <div className="flex flex-col gap-4">
      <SubHeader
        emoji="🎉"
        title="Milestones"
        action={
          editing === null ? (
            <Button onClick={() => setEditing("new")} className="px-4 py-2 text-sm">
              Add
            </Button>
          ) : null
        }
      />
      {editing !== null && <MilestoneForm key={editing === "new" ? "new" : editing.id} row={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      {list.length === 0 && editing === null && <Card className="py-8 text-center text-muted">No dates yet. Add a birthday, an anniversary, the day you met…</Card>}
      {list.map((u) => (
        <Card key={u.id} className={cn("flex items-center gap-3", u.daysToGo < 0 && "opacity-60")}>
          <span className="text-3xl" aria-hidden>
            {u.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-lg font-semibold leading-tight">
              {u.derived && u.years !== null ? `Friends for ${u.years} ${u.years === 1 ? "year" : "years"}` : u.title}
            </p>
            <p className="text-xs text-muted">
              {format(dateKeyToLocalDate(u.nextDate), "EEE, d MMM yyyy")}
              {u.repeatYearly && !u.derived && u.years !== null && u.years > 0 && ` · ${u.years}${ordinal(u.years)} time`}
            </p>
          </div>
          <div className="text-right">
            <p className="font-heading text-xl font-semibold">{u.daysToGo === 0 ? "Today!" : u.daysToGo > 0 ? `${u.daysToGo}d` : `${-u.daysToGo}d ago`}</p>
          </div>
          {!u.derived && (
            <div className="flex">
              <button type="button" onClick={() => setEditing(rows.find((r) => r.id === u.id) ?? null)} aria-label="Edit milestone" className="tap grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2">
                <Pencil size={16} />
              </button>
              <button type="button" onClick={() => void deleteMilestone(u.id)} aria-label="Delete milestone" className="tap grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2">
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </Card>
      ))}
      {pair.friendsSince === null && <p className="px-2 text-center text-xs text-muted">Set your friends-since date in More to get a yearly friendiversary here.</p>}
    </div>
  );
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}

function MilestoneForm({ row, onDone }: { row: Row | null; onDone: () => void }) {
  const [title, setTitle] = useState(row?.title ?? "");
  const [date, setDate] = useState(row?.date ?? "");
  const [emoji, setEmoji] = useState(row?.emoji ?? EMOJI[0]);
  const [repeatYearly, setRepeat] = useState(row?.repeatYearly ?? true);
  const [busy, setBusy] = useState(false);
  const canSave = title.trim().length > 0 && isDateKey(date) && !busy;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    try {
      const input: MilestoneInput = { title, date, emoji, repeatYearly };
      if (row) await editMilestone(row.id, input);
      else await addMilestone(input);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Emoji" className="flex flex-wrap gap-1">
        {EMOJI.map((e) => (
          <button key={e} type="button" role="radio" aria-checked={emoji === e} onClick={() => setEmoji(e)} className={cn("tap grid place-items-center rounded-2xl text-2xl", emoji === e ? "bg-accent-soft" : "hover:bg-surface-2")}>
            {e}
          </button>
        ))}
      </div>
      <Input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 60))} placeholder="What's the occasion?" aria-label="Title" autoFocus />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ms-date">Date</Label>
        <Input id="ms-date" type="date" value={date} max="9999-12-31" onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="flex items-center justify-between">
        <label htmlFor="ms-repeat" className="text-sm font-semibold">
          Repeats every year
        </label>
        <Switch id="ms-repeat" checked={repeatYearly} onChange={setRepeat} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={save} disabled={!canSave} className="px-5">
          {busy ? "Saving…" : row ? "Save" : "Add"}
        </Button>
      </div>
    </Card>
  );
}
