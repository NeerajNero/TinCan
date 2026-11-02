"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AgendaList } from "@/components/plan/AgendaList";
import { EventEditor } from "@/components/plan/EventEditor";
import { MarkBusySheet } from "@/components/plan/MarkBusySheet";
import { HowToButton } from "@/components/ui/HowTo";
import { useStickyValue } from "@/components/ui/Sheet";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useEvents } from "@/hooks/useEvents";
import { usePair } from "@/hooks/usePair";
import { useRelationship } from "@/hooks/useRelationship";
import type { EventContext } from "@/lib/db/events";
import { buildAgenda, UPCOMING_INLINE_DAYS, type AgendaItem, type EventWithId } from "@/lib/upcoming";

type Editor = { kind: "new" } | { kind: "edit"; event: EventWithId } | { kind: "busy" } | null;

/** Plan → Upcoming (phase 29): the next 7 days inline over the one events listener, with Add, Mark busy and See all. */
export function UpcomingSection({ today }: { today: string }) {
  const { uid, me, friend, friendUid, pair } = usePair();
  const preset = useRelationship();
  const { events, ready } = useEvents(today);
  const [editor, setEditor] = useState<Editor>(null);
  const shown = useStickyValue(editor);
  const ctx: EventContext = { current: events, today, prevSummary: pair.nextCountdown };
  const days = buildAgenda({ events, milestones: pair.milestonesSummary, friendsSince: pair.friendsSince, preset, trips: pair.tripsSummary, from: today, days: UPCOMING_INLINE_DAYS, today });

  function openEvent(item: AgendaItem) {
    const event = events.find((e) => e.id === item.id);
    if (event) setEditor({ kind: "edit", event });
  }

  return (
    <section className="flex flex-col gap-2" aria-label="Upcoming">
      <div className="flex items-center gap-1 px-1">
        <h2 className="flex-1 text-sm font-bold tracking-wide text-muted uppercase">Upcoming</h2>
        <HowToButton topic="upcoming" autoOpen={false} className="size-9" />
        <Link href="/plan/upcoming" className="tap rounded-full px-3 py-1.5 text-sm font-semibold text-[var(--accent)]">
          See all
        </Link>
      </div>
      <div className="flex gap-2 px-1">
        <button type="button" onClick={() => setEditor({ kind: "new" })} className="tap inline-flex min-h-10 items-center gap-1 rounded-full bg-[var(--accent)] px-3.5 text-sm font-bold text-white shadow-sm">
          <Plus size={16} aria-hidden /> Add
        </button>
        <button type="button" onClick={() => setEditor({ kind: "busy" })} className="tap inline-flex min-h-10 items-center gap-1 rounded-full bg-surface px-3.5 text-sm font-bold text-muted shadow-sm">
          ⛔ Mark busy
        </button>
      </div>
      {!ready && <ListSkeleton rows={2} />}
      {ready && days.length === 0 && (
        <p className="card rounded-[24px] px-4 py-5 text-center text-sm text-muted">Nothing in the next {UPCOMING_INLINE_DAYS} days — add something you&apos;re looking forward to?</p>
      )}
      {ready && days.length > 0 && <AgendaList days={days} today={today} uid={uid} me={me} friend={friend} onEvent={openEvent} />}

      <EventEditor
        open={editor?.kind === "new" || editor?.kind === "edit"}
        onClose={() => setEditor(null)}
        uid={uid}
        friendUid={friendUid}
        friendName={friend?.nickname ?? "your friend"}
        event={shown?.kind === "edit" ? shown.event : null}
        defaultDate={today}
        ctx={ctx}
      />
      <MarkBusySheet open={editor?.kind === "busy"} onClose={() => setEditor(null)} uid={uid} today={today} ctx={ctx} />
    </section>
  );
}
