"use client";

import { useEffect, useState } from "react";

import { eventsQuery } from "@/lib/db/events";
import { onSnapshot, type QueryDocumentSnapshot } from "@/lib/firebase/fs";
import type { EventDoc } from "@/lib/types";
import type { EventWithId } from "@/lib/upcoming";

const mapDoc = (d: QueryDocumentSnapshot<EventDoc>): EventWithId => ({ id: d.id, ...d.data() });

/** Plan's one new listener (phase 29): events from today on, ≤ 50, attached only while a Plan screen is mounted. */
export function useEvents(today: string): { events: EventWithId[]; ready: boolean } {
  const [events, setEvents] = useState<EventWithId[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const unsub = onSnapshot(eventsQuery(today), (snap) => {
      setEvents(snap.docs.map(mapDoc));
      setReady(true);
    });
    return () => {
      unsub();
      setReady(false);
    };
  }, [today]);
  return { events, ready };
}
