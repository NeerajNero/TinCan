import { pairRef } from "@/lib/db/refs";
import { getDb } from "@/lib/firebase/client";
import { addDoc, collection, deleteDoc, doc, limit, orderBy, query, serverTimestamp, startAfter, updateDoc, where, type CollectionReference, type Query, type QueryDocumentSnapshot } from "@/lib/firebase/fs";
import { notify } from "@/lib/notify";
import { swallow } from "@/lib/swallow";
import type { CountdownSummary, DateKey, EventDoc } from "@/lib/types";
import { busyEvent, cleanEvent, countdownSummaryFrom, EVENTS_PAGE, eventLine, summaryChanged, type EventFields, type EventWithId } from "@/lib/upcoming";

const eventsCol = () => collection(getDb(), "events") as CollectionReference<EventDoc>;

/** Events from `today` on, by date, 50 a page (the single-field index serves the range + order on `date`). */
export function eventsQuery(today: DateKey, after: QueryDocumentSnapshot<EventDoc> | null = null): Query<EventDoc> {
  return after
    ? query(eventsCol(), where("date", ">=", today), orderBy("date", "asc"), startAfter(after), limit(EVENTS_PAGE))
    : query(eventsCol(), where("date", ">=", today), orderBy("date", "asc"), limit(EVENTS_PAGE));
}

/** The writer keeps `pair/main.nextCountdown` current from the list it already holds, so Home needs no events listener. */
async function mirror(events: EventWithId[], today: DateKey, prev: CountdownSummary | null | undefined): Promise<void> {
  const next = countdownSummaryFrom(events, today);
  if (!summaryChanged(prev, next)) return;
  await updateDoc(pairRef(), { nextCountdown: next });
}

export interface EventContext {
  /** The events the screen currently holds (its listener), used to recompute the mirrored summary. */
  current: EventWithId[];
  today: DateKey;
  prevSummary: CountdownSummary | null | undefined;
}

/** Add an event, mirror the countdown summary, and tell the friend (push type `event-added` → inbox row). */
export async function addEvent(uid: string, input: EventFields, ctx: EventContext): Promise<string> {
  const data = cleanEvent(input);
  const ref = await addDoc(eventsCol(), { ...data, createdBy: uid, createdAt: serverTimestamp() });
  const added: EventWithId = { ...data, id: ref.id, createdBy: uid, createdAt: null };
  await mirror([...ctx.current.filter((e) => e.id !== ref.id), added], ctx.today, ctx.prevSummary);
  void notify("event-added", { body: eventLine(data) }).catch(swallow);
  return ref.id;
}

export async function editEvent(id: string, input: EventFields, ctx: EventContext): Promise<void> {
  const prev = ctx.current.find((e) => e.id === id);
  const fields = cleanEvent(input);
  await updateDoc(doc(eventsCol(), id), {
    ...fields,
    // Clear optional fields that the edit removed.
    ...(fields.emoji ? {} : { emoji: null }),
    ...(fields.endDate ? {} : { endDate: null }),
    ...(fields.time ? {} : { time: null }),
  });
  const edited: EventWithId = { ...(prev ?? { createdAt: null, createdBy: "" }), ...fields, id, createdBy: prev?.createdBy ?? "", createdAt: prev?.createdAt ?? null };
  await mirror(ctx.current.map((e) => (e.id === id ? edited : e)), ctx.today, ctx.prevSummary);
}

export async function deleteEvent(id: string, ctx: EventContext): Promise<void> {
  await deleteDoc(doc(eventsCol(), id));
  await mirror(ctx.current.filter((e) => e.id !== id), ctx.today, ctx.prevSummary);
}

/** "Mark busy": one all-day event for me over the range, in one tap. */
export function markBusy(uid: string, start: DateKey, end: DateKey, ctx: EventContext): Promise<string> {
  return addEvent(uid, busyEvent(uid, start, end), ctx);
}
