"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useNow } from "@/hooks/useNow";
import { usePair } from "@/hooks/usePair";
import { fmtDay, fmtTime, intersect, projectWeek, remapToZone, slotLabel, SLOTS_PER_DAY, toWindows } from "@/lib/availability";
import { cn } from "@/lib/cn";
import { availabilityRef, saveAvailability } from "@/lib/db/availability";
import { sendText } from "@/lib/db/messages";
import { onSnapshot } from "@/lib/firebase/fs";
import { notify } from "@/lib/notify";
import { WEEKDAY_KEYS, type AvailabilityDoc, type WeekdayKey } from "@/lib/types";

type Grid = Record<WeekdayKey, Set<number>>;
const DAY_LABEL: Record<WeekdayKey, string> = { mon: "Mo", tue: "Tu", wed: "We", thu: "Th", fri: "Fr", sat: "Sa", sun: "Su" };

const emptyGrid = (): Grid => Object.fromEntries(WEEKDAY_KEYS.map((d) => [d, new Set<number>()])) as Grid;
const fromDoc = (doc: AvailabilityDoc | null): Grid => {
  const g = emptyGrid();
  if (doc) for (const d of WEEKDAY_KEYS) for (const label of doc.slots[d] ?? []) g[d].add(Number(label.slice(0, 2)) * 2 + (label.endsWith("30") ? 1 : 0));
  return g;
};
const toSlots = (g: Grid) => Object.fromEntries(WEEKDAY_KEYS.map((d) => [d, Array.from(g[d]).sort((a, b) => a - b).map(slotLabel)]));

export function CallsScreen() {
  const { uid, me, friend, friendUid } = usePair();
  const now = useNow(60_000);
  const [tab, setTab] = useState<"mine" | "overlap">("mine");
  const [mine, setMine] = useState<AvailabilityDoc | null>(null);
  const [theirs, setTheirs] = useState<AvailabilityDoc | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const a = onSnapshot(availabilityRef(uid), (snap) => {
      setMine(snap.exists() ? snap.data() : null);
      setLoaded(true);
    });
    const b = friendUid ? onSnapshot(availabilityRef(friendUid), (snap) => setTheirs(snap.exists() ? snap.data() : null)) : () => undefined;
    return () => {
      a();
      b();
    };
  }, [uid, friendUid]);

  const friendName = friend?.nickname ?? "your friend";
  const friendTz = friend?.tz ?? me.tz;
  const theirsInMyZone = useMemo(() => remapToZone(theirs, friendTz, me.tz, now), [theirs, friendTz, me.tz, now]);
  const windows = useMemo(() => toWindows(intersect(projectWeek(mine, me.tz, now), projectWeek(theirs, friendTz, now)), now), [mine, theirs, me.tz, friendTz, now]);

  async function propose(startMs: number) {
    const text = `📞 Call? ${fmtDay(startMs, me.tz)} ${fmtTime(startMs, me.tz)} for me / ${fmtTime(startMs, friendTz)} for you`;
    const id = await sendText(uid, text, null);
    if (friendUid) void notify("message", { toUid: friendUid, body: text, data: { messageId: id } });
  }

  return (
    <div className="flex flex-col gap-4">
      <SubHeader help="calls" emoji="📞" title="Call-time finder" back="/plan" />
      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
        {(["mine", "overlap"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("tap rounded-full py-2 text-sm font-bold", tab === t ? "bg-surface shadow-sm" : "text-muted")}>
            {t === "mine" ? "My week" : "Overlap"}
          </button>
        ))}
      </div>

      {tab === "mine" && loaded && <PaintGrid uid={uid} tz={me.tz} initial={fromDoc(mine)} />}

      {tab === "overlap" && (
        <>
          <Card className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Next windows</h2>
            {!theirs && <p className="text-sm text-muted">{friendName} hasn&apos;t painted their week yet.</p>}
            {theirs && !mine && <p className="text-sm text-muted">Paint your week first.</p>}
            {theirs && mine && windows.length === 0 && <p className="text-sm text-muted">No overlap in the coming week. Loosen up a few slots?</p>}
            {windows.map((w) => (
              <div key={w.start} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {fmtDay(w.start, me.tz)} {fmtTime(w.start, me.tz)} – {fmtTime(w.end, me.tz)}
                  </p>
                  <p className="text-xs text-muted">
                    {friendName}: {fmtDay(w.start, friendTz)} {fmtTime(w.start, friendTz)} – {fmtTime(w.end, friendTz)} · {w.slots * 30} min
                  </p>
                </div>
                <Button onClick={() => void propose(w.start)} className="px-4 py-2 text-sm">
                  Propose
                </Button>
              </div>
            ))}
          </Card>
          <ReadGrid mine={fromDoc(mine)} theirs={theirsInMyZone} friendName={friendName} />
        </>
      )}
    </div>
  );
}

/* ── paint grid (7 × 48, tap or drag) ──────────────────────────────────── */

function PaintGrid({ uid, tz, initial }: { uid: string; tz: string; initial: Grid }) {
  const [grid, setGrid] = useState<Grid>(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const paint = useRef<{ value: boolean } | null>(null);
  const container = useRef<HTMLDivElement>(null);

  function cellAt(x: number, y: number): [WeekdayKey, number] | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const d = el?.dataset.day as WeekdayKey | undefined;
    const s = el?.dataset.slot;
    return d && s !== undefined ? [d, Number(s)] : null;
  }
  function apply(day: WeekdayKey, slot: number, value: boolean) {
    setGrid((g) => {
      if (g[day].has(slot) === value) return g;
      const next = { ...g, [day]: new Set(g[day]) };
      if (value) next[day].add(slot);
      else next[day].delete(slot);
      return next;
    });
    setDirty(true);
  }
  function onPointerDown(e: React.PointerEvent) {
    const hit = cellAt(e.clientX, e.clientY);
    if (!hit) return;
    container.current?.setPointerCapture(e.pointerId);
    const value = !grid[hit[0]].has(hit[1]);
    paint.current = { value };
    apply(hit[0], hit[1], value);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!paint.current) return;
    const hit = cellAt(e.clientX, e.clientY);
    if (hit) apply(hit[0], hit[1], paint.current.value);
  }
  function onPointerUp() {
    paint.current = null;
  }
  async function save() {
    setSaving(true);
    try {
      await saveAvailability(uid, tz, toSlots(grid));
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-muted">Tap or drag to paint when you can talk · {tz}</p>
        <Button onClick={save} disabled={!dirty || saving} className="px-4 py-2 text-sm">
          {saving ? "Saving…" : dirty ? "Save" : "Saved"}
        </Button>
      </div>
      <div ref={container} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} className="touch-none select-none">
        <GridTable render={(day, slot) => <div data-day={day} data-slot={slot} className={cn("h-full w-full", grid[day].has(slot) ? "bg-[var(--accent)]" : "bg-surface-2")} />} />
      </div>
    </Card>
  );
}

function ReadGrid({ mine, theirs, friendName }: { mine: Grid; theirs: Partial<Record<WeekdayKey, Set<number>>>; friendName: string }) {
  return (
    <Card className="flex flex-col gap-2 p-3">
      <p className="px-1 text-sm text-muted">Both weeks in your time zone</p>
      <GridTable
        render={(day, slot) => {
          const m = mine[day].has(slot);
          const t = theirs[day]?.has(slot) ?? false;
          return <div className={cn("h-full w-full", m && t ? "bg-emerald-400" : m ? "bg-[var(--accent)]/45" : t ? "bg-[var(--accent-memories)]/45" : "bg-surface-2")} />;
        }}
      />
      <div className="flex flex-wrap gap-3 px-1 text-[11px] text-muted">
        <span><i className="inline-block size-3 rounded-sm bg-[var(--accent)]/45 align-middle" /> you</span>
        <span><i className="inline-block size-3 rounded-sm bg-[var(--accent-memories)]/45 align-middle" /> {friendName}</span>
        <span><i className="inline-block size-3 rounded-sm bg-emerald-400 align-middle" /> both</span>
      </div>
    </Card>
  );
}

function GridTable({ render }: { render: (day: WeekdayKey, slot: number) => React.ReactNode }) {
  return (
    <div className="grid gap-px" style={{ gridTemplateColumns: "36px repeat(7, 1fr)" }}>
      <span />
      {WEEKDAY_KEYS.map((d) => (
        <span key={d} className="pb-1 text-center text-[11px] font-bold text-muted">
          {DAY_LABEL[d]}
        </span>
      ))}
      {Array.from({ length: SLOTS_PER_DAY }, (_, slot) => (
        <RowCells key={slot} slot={slot} render={render} />
      ))}
    </div>
  );
}

function RowCells({ slot, render }: { slot: number; render: (day: WeekdayKey, slot: number) => React.ReactNode }) {
  return (
    <>
      <span className="pr-1 text-right text-[10px] leading-[14px] text-muted">{slot % 2 === 0 ? `${slot / 2}`.padStart(2, "0") : ""}</span>
      {WEEKDAY_KEYS.map((d) => (
        <div key={d} className={cn("h-[14px] overflow-hidden", slot % 2 === 0 ? "rounded-t-sm" : "rounded-b-sm")}>
          {render(d, slot)}
        </div>
      ))}
    </>
  );
}
