"use client";

import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import { MeetupEditor } from "@/components/more/PairCard";
import { Card } from "@/components/ui/Card";
import { usePair } from "@/hooks/usePair";
import { dateKeyToLocalDate, daysBetween } from "@/lib/dates";
import { resolveCountdown } from "@/lib/meetup";

/** Plan's hero: days until the meetup (or nearest trip), with the meetup editable inline. */
export function CountdownHero({ today }: { today: string }) {
  const { pair } = usePair();
  const [editing, setEditing] = useState(false);
  const target = resolveCountdown(pair, today);
  const days = target ? daysBetween(today, target.date) : null;

  return (
    <Card className="flex flex-col gap-3 bg-accent-soft">
      <div className="flex items-center gap-4">
        <span className="text-5xl" aria-hidden>
          {days === null ? "🗓️" : days <= 0 ? "🎉" : target?.source === "trip" ? "🧳" : "✈️"}
        </span>
        <div className="min-w-0 flex-1">
          {target && days !== null ? (
            <>
              <p className="font-heading text-4xl font-semibold leading-none">{days > 1 ? `${days} days` : days === 1 ? "Tomorrow" : days === 0 ? "Today!" : `${-days} days ago`}</p>
              <p className="mt-1 truncate text-sm text-muted">
                {[target.label, target.place].filter(Boolean).join(" · ") || (target.source === "trip" ? "Next trip" : "Next meetup")} · {format(dateKeyToLocalDate(target.date), "EEE, d MMM")}
                {target.source === "trip" && " (from your trips)"}
              </p>
            </>
          ) : (
            <>
              <p className="font-heading text-2xl font-semibold leading-tight">No meetup planned</p>
              <p className="text-sm text-muted">Set a date and this becomes a countdown.</p>
            </>
          )}
        </div>
        <button type="button" onClick={() => setEditing((v) => !v)} className="tap rounded-full bg-surface px-3 py-1.5 text-xs font-bold text-muted shadow-sm">
          {editing ? "Close" : pair.nextMeetup ? "Edit" : "Set"}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {editing && (
          <motion.div key="edit" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="rounded-2xl bg-surface p-3">
              <MeetupEditor initial={pair.nextMeetup} onDone={() => setEditing(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
