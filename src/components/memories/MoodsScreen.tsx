"use client";

import { addMonths, format, subMonths } from "date-fns";
import { onSnapshot } from "firebase/firestore";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { Card } from "@/components/ui/Card";
import { usePair } from "@/hooks/usePair";
import { cn } from "@/lib/cn";
import { dateKeyIn, dateKeyToLocalDate } from "@/lib/dates";
import { moodsForMonth } from "@/lib/db/moods";
import type { MoodDoc } from "@/lib/types";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function MoodsScreen() {
  const { uid, me, friend, friendUid } = usePair();
  const [month, setMonth] = useState(() => new Date());
  const [moods, setMoods] = useState<Map<string, MoodDoc>>(() => new Map());
  const [selected, setSelected] = useState<string | null>(null);
  const yearMonth = format(month, "yyyy-MM");
  const today = dateKeyIn(me.tz);

  useEffect(() => {
    const unsub = onSnapshot(moodsForMonth(yearMonth), (snap) => {
      setMoods(new Map(snap.docs.map((d) => [d.id, d.data()])));
    });
    return () => {
      unsub();
      setMoods(new Map());
    };
  }, [yearMonth]);

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7; // Monday first
    const cells: Array<string | null> = Array(lead).fill(null);
    for (let d = 1; d <= count; d++) cells.push(`${yearMonth}-${d.toString().padStart(2, "0")}`);
    return cells;
  }, [month, yearMonth]);

  const moodOf = (key: string, who: string | null) => (who ? moods.get(`${key}_${who}`) : undefined);
  const sel = selected ? { mine: moodOf(selected, uid), theirs: moodOf(selected, friendUid) } : null;

  return (
    <div className="flex flex-col gap-4">
      <SubHeader emoji="🗓️" title="Moods" />
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setMonth((m) => subMonths(m, 1))} aria-label="Previous month" className="tap grid size-11 place-items-center rounded-full hover:bg-surface-2">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-semibold">{format(month, "MMMM yyyy")}</h2>
          <button type="button" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month" className="tap grid size-11 place-items-center rounded-full hover:bg-surface-2">
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-muted">
          {WEEKDAYS.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((key, i) =>
            key ? (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                aria-label={format(dateKeyToLocalDate(key), "d MMMM")}
                aria-pressed={selected === key}
                className={cn(
                  "tap flex aspect-square flex-col items-center justify-center rounded-xl text-xs",
                  selected === key ? "bg-accent-soft" : "hover:bg-surface-2",
                  key === today && "ring-2 ring-[var(--accent)]",
                  key > today && "opacity-40",
                )}
              >
                <span className="text-[10px] font-bold text-muted">{Number(key.slice(-2))}</span>
                <span className="flex gap-0.5 text-base leading-none">
                  <span>{moodOf(key, uid)?.emoji ?? "·"}</span>
                  <span>{moodOf(key, friendUid)?.emoji ?? "·"}</span>
                </span>
              </button>
            ) : (
              <span key={`pad-${i}`} />
            ),
          )}
        </div>
        <p className="text-center text-[11px] text-muted">Left: you · Right: {friend?.nickname ?? "friend"}</p>
      </Card>

      {selected && sel && (
        <Card className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">{format(dateKeyToLocalDate(selected), "EEEE, d MMM yyyy")}</p>
          <DayRow who="You" mood={sel.mine} />
          <DayRow who={friend?.nickname ?? "Friend"} mood={sel.theirs} />
        </Card>
      )}
    </div>
  );
}

function DayRow({ who, mood }: { who: string; mood?: MoodDoc }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2">
      <span className="text-2xl" aria-hidden>
        {mood?.emoji ?? "·"}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">{who}</p>
        <p className={cn("text-sm", mood ? "" : "text-muted")}>{mood ? mood.note || "Checked in" : "No check-in"}</p>
      </div>
    </div>
  );
}
