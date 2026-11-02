"use client";

import { useCallback, useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { AgendaList } from "@/components/plan/AgendaList";
import { EventEditor } from "@/components/plan/EventEditor";
import { Button } from "@/components/ui/Button";
import { useStickyValue } from "@/components/ui/Sheet";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useNow } from "@/hooks/useNow";
import { usePagedCollection } from "@/hooks/usePagedCollection";
import { usePair } from "@/hooks/usePair";
import { useRelationship } from "@/hooks/useRelationship";
import { roomDateKey } from "@/lib/dates";
import { eventsQuery, type EventContext } from "@/lib/db/events";
import type { QueryDocumentSnapshot } from "@/lib/firebase/fs";
import type { EventDoc } from "@/lib/types";
import { buildAgenda, EVENTS_PAGE, UPCOMING_MAX_DAYS, UPCOMING_WINDOW_DAYS, type AgendaItem, type EventWithId } from "@/lib/upcoming";

const mapDoc = (d: QueryDocumentSnapshot<EventDoc>): EventWithId => ({ id: d.id, ...d.data() });
const byDate = (a: EventWithId, b: EventWithId) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id);

/** "See all": the agenda further ahead — 30 days at a time, events paged by 50 (the first page live, the rest one-shot). */
export function UpcomingScreen() {
  const { uid, me, friend, friendUid, pair } = usePair();
  const preset = useRelationship();
  const now = useNow(60_000);
  const today = roomDateKey(pair, now);
  const makeQuery = useCallback((after: QueryDocumentSnapshot<EventDoc> | null) => eventsQuery(today, after), [today]);
  const { items: events, ready, hasMore, loadingMore, loadMore } = usePagedCollection(makeQuery, EVENTS_PAGE, mapDoc, byDate);
  const [windowDays, setWindowDays] = useState(UPCOMING_WINDOW_DAYS);
  const [editing, setEditing] = useState<EventWithId | null>(null);
  const shown = useStickyValue(editing);
  const ctx: EventContext = { current: events, today, prevSummary: pair.nextCountdown };
  const days = buildAgenda({ events, milestones: pair.milestonesSummary, friendsSince: pair.friendsSince, preset, trips: pair.tripsSummary, from: today, days: windowDays, today });
  const canExtend = windowDays < UPCOMING_MAX_DAYS;

  function further() {
    if (hasMore) loadMore();
    setWindowDays((d) => Math.min(UPCOMING_MAX_DAYS, d + UPCOMING_WINDOW_DAYS));
  }
  function openEvent(item: AgendaItem) {
    const event = events.find((e) => e.id === item.id);
    if (event) setEditing(event);
  }

  return (
    <div className="flex flex-col gap-4">
      <SubHeader emoji="📅" title="Upcoming" back="/plan" help="upcoming" />
      <p className="-mt-2 px-1 text-xs text-muted">The next {windowDays} days: your events, milestones, festivals and trips.</p>
      {!ready && <ListSkeleton rows={3} />}
      {ready && days.length === 0 && <p className="card rounded-[24px] px-4 py-6 text-center text-sm text-muted">Nothing in the next {windowDays} days.</p>}
      {ready && days.length > 0 && <AgendaList days={days} today={today} uid={uid} me={me} friend={friend} onEvent={openEvent} />}
      {ready && (canExtend || hasMore) && (
        <Button variant="soft" onClick={further} disabled={loadingMore} className="self-center">
          {loadingMore ? "Loading…" : `Show the next ${UPCOMING_WINDOW_DAYS} days`}
        </Button>
      )}
      <EventEditor open={editing !== null} onClose={() => setEditing(null)} uid={uid} friendUid={friendUid} friendName={friend?.nickname ?? "your friend"} event={shown} defaultDate={today} ctx={ctx} />
    </div>
  );
}
