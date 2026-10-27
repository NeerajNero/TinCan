"use client";

import { format } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { useToast } from "@/components/toast/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { useNow } from "@/hooks/useNow";
import { usePair } from "@/hooks/usePair";
import { useRelationship } from "@/hooks/useRelationship";
import { cn } from "@/lib/cn";
import { dateKeyToLocalDate, isDateKey, roomDateKey } from "@/lib/dates";
import { addMilestone, clearVerify, deleteMilestone, editMilestone, importFestivals, milestonesQuery, type MilestoneInput } from "@/lib/db/milestones";
import { onSnapshot, type QueryDocumentSnapshot } from "@/lib/firebase/fs";
import { friendsSinceMilestone, sortUpcoming, toUpcoming, yearsLine, type Upcoming } from "@/lib/milestones";
import { EFFECTS, type Effect, type MilestoneDoc } from "@/lib/types";

interface Row extends MilestoneDoc {
  id: string;
}
const mapDoc = (d: QueryDocumentSnapshot<MilestoneDoc>): Row => ({ id: d.id, ...d.data() });
const EMOJI = ["🎉", "🎂", "🧵", "✈️", "💖", "🎓", "🏠", "🌟", "🍰", "🎁"];
const EFFECT_LABEL: Record<Effect, string> = { diyas: "🪔 Diyas", colours: "🎨 Colours", snow: "❄️ Snow", fireworks: "🎆 Fireworks", kites: "🪁 Kites", flowers: "🌸 Flowers", confetti: "🎊 Confetti" };

export function MilestonesScreen() {
  const { pair } = usePair();
  const preset = useRelationship();
  const now = useNow(60_000);
  const today = roomDateKey(pair, now);
  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  // A push's deep link (?edit=<id>) opens that milestone's editor once the rows are in (derived during render, once per id).
  const editParam = useSearchParams().get("edit");
  const [openedParam, setOpenedParam] = useState<string | null>(null);
  if (editParam && openedParam !== editParam) {
    const row = rows.find((r) => r.id === editParam);
    if (row) {
      setOpenedParam(editParam);
      setEditing(row);
    }
  }
  const { toast } = useToast();

  async function addFestivals() {
    if (importing) return;
    setImporting(true);
    try {
      const n = await importFestivals(today);
      toast({ key: "festivals", emoji: "🪔", title: n === 0 ? "All festivals already here" : `Added ${n} ${n === 1 ? "festival" : "festivals"}`, body: n === 0 ? "Nothing new to add" : "Edit or delete any of them like other milestones", vibrate: false });
    } catch {
      toast({ key: "festivals", emoji: "😵", title: "Couldn't add festivals", body: "Try again in a moment", vibrate: false });
    } finally {
      setImporting(false);
    }
  }

  useEffect(() => {
    const unsub = onSnapshot(milestonesQuery(), (snap) => setRows(snap.docs.map(mapDoc)));
    return () => unsub();
  }, []);

  const list = useMemo<Upcoming[]>(() => {
    const items = rows.map((r) => toUpcoming({ id: r.id, title: r.title, emoji: r.emoji, date: r.date, repeatYearly: r.repeatYearly, ...(r.effect ? { effect: r.effect } : {}) }, today));
    const fs = friendsSinceMilestone(pair.friendsSince, preset);
    if (fs) items.push(toUpcoming(fs, today, true));
    return sortUpcoming(items);
  }, [rows, pair.friendsSince, today, preset]);

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
      {editing === null && (
        <Card className="flex items-center gap-3 px-4 py-3">
          <span className="text-2xl" aria-hidden>
            🪔
          </span>
          <span className="min-w-0 flex-1 text-sm">
            <span className="block font-semibold">Festivals</span>
            <span className="block text-xs text-muted">Sankranti, Holi, Eid, Diwali, Christmas… with effects on the day. Already-added ones are skipped.</span>
          </span>
          <Button variant="soft" onClick={() => void addFestivals()} disabled={importing} className="shrink-0 px-3 py-2 text-sm">
            {importing ? "Adding…" : "Add festivals"}
          </Button>
        </Card>
      )}
      {list.length === 0 && editing === null && <Card className="py-8 text-center text-muted">No dates yet — add a birthday, an anniversary, or the day you met?</Card>}
      {list.map((u) => (
        <Card key={u.id} className={cn("flex items-center gap-3", u.daysToGo < 0 && "opacity-60")}>
          <span className="text-3xl" aria-hidden>
            {u.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-lg font-semibold leading-tight">
              {u.derived && u.years !== null ? `${u.title} · ${yearsLine(u.years, preset.pairNoun)}` : u.title}
            </p>
            <p className="text-xs text-muted">
              {format(dateKeyToLocalDate(u.nextDate), "EEE, d MMM yyyy")}
              {u.repeatYearly && !u.derived && u.years !== null && u.years > 0 && ` · ${u.years}${ordinal(u.years)} time`}
              {u.effect && ` · ${EFFECT_LABEL[u.effect]}`}
              {rows.find((r) => r.id === u.id)?.verify && <span className="ml-1 rounded-full bg-amber-400/25 px-1.5 py-0.5 text-[10px] font-bold">⚠️ check the date</span>}
            </p>
            {rows.find((r) => r.id === u.id)?.verify && (
              <button type="button" onClick={() => void clearVerify(u.id)} className="tap mt-1 min-h-9 rounded-full bg-surface-2 px-3 text-xs font-bold">
                Looks right ✓
              </button>
            )}
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
      {pair.friendsSince === null && <p className="px-2 text-center text-xs text-muted">Set your “{preset.sinceLabel}” date in More to get a yearly {preset.anniversaryLabel.toLowerCase()} here.</p>}
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
  const [emoji, setEmoji] = useState(row?.emoji ?? EMOJI[0]!);
  const [repeatYearly, setRepeat] = useState(row?.repeatYearly ?? true);
  const [effect, setEffect] = useState<Effect | null>(row?.effect ?? null);
  const [verify, setVerify] = useState(row?.verify === true);
  const [busy, setBusy] = useState(false);
  const canSave = title.trim().length > 0 && isDateKey(date) && !busy;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    try {
      const input: MilestoneInput = { title, date, emoji, repeatYearly, ...(effect ? { effect } : {}), ...(verify ? { verify: true } : {}) };
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
        <Input
          id="ms-date"
          type="date"
          value={date}
          max="9999-12-31"
          onChange={(e) => {
            setDate(e.target.value);
            // Changing the date counts as checking it.
            if (row && e.target.value !== row.date) setVerify(false);
          }}
        />
      </div>
      <div className="flex items-center justify-between">
        <label htmlFor="ms-repeat" className="text-sm font-semibold">
          Repeats every year
        </label>
        <Switch id="ms-repeat" checked={repeatYearly} onChange={setRepeat} />
      </div>
      <div className="flex items-center justify-between">
        <label htmlFor="ms-verify" className="text-sm font-semibold">
          ⚠️ Date needs checking
          <span className="block text-xs font-normal text-muted">A reminder to both of you 7 days before</span>
        </label>
        <Switch id="ms-verify" checked={verify} onChange={setVerify} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ms-effect">Effect on the day</Label>
        <div id="ms-effect" role="radiogroup" aria-label="Effect" className="flex flex-wrap gap-1.5">
          <button type="button" role="radio" aria-checked={effect === null} onClick={() => setEffect(null)} className={cn("tap min-h-9 rounded-full px-3 text-xs font-bold", effect === null ? "bg-accent text-accent-ink" : "bg-surface-2")}>
            None
          </button>
          {EFFECTS.map((e) => (
            <button key={e} type="button" role="radio" aria-checked={effect === e} onClick={() => setEffect(e)} className={cn("tap min-h-9 rounded-full px-3 text-xs font-bold", effect === e ? "bg-accent text-accent-ink" : "bg-surface-2")}>
              {EFFECT_LABEL[e]}
            </button>
          ))}
        </div>
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
