
import { addDays, daysBetween, isDateKey } from "@/lib/dates";
import { pairRef } from "@/lib/db/refs";
import { getDb } from "@/lib/firebase/client";
import { addDoc, collection, deleteDoc, doc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, type CollectionReference, type Query } from "@/lib/firebase/fs";
import type { DateKey, TripDay, TripDoc, TripStop, TripSummary } from "@/lib/types";

const tripsCol = () => collection(getDb(), "trips") as CollectionReference<TripDoc>;
export const tripsQuery = (): Query<TripDoc> => query(tripsCol(), orderBy("startDate", "asc"), limit(100));

/** One TripDay per date in the range, keeping stops for dates that still exist. */
function buildDays(startDate: DateKey, endDate: DateKey, previous: TripDay[] = []): TripDay[] {
  if (!isDateKey(startDate) || !isDateKey(endDate)) return [];
  const span = Math.max(0, Math.min(60, daysBetween(startDate, endDate)));
  const byDate = new Map(previous.map((d) => [d.date, d.stops]));
  return Array.from({ length: span + 1 }, (_, i) => {
    const date = addDays(startDate, i);
    return { date, stops: byDate.get(date) ?? [] };
  });
}

/** Mirror upcoming trips onto pair/main for the countdown fallback (no extra listener). */
async function syncSummary(): Promise<void> {
  const snap = await getDocs(tripsQuery());
  const summary: TripSummary[] = snap.docs.map((d) => {
    const t = d.data();
    return { id: d.id, title: t.title, place: t.place, startDate: t.startDate, endDate: t.endDate };
  }).slice(0, 20);
  await updateDoc(pairRef(), { tripsSummary: summary });
}

export interface TripInput {
  title: string;
  place: string;
  startDate: DateKey;
  endDate: DateKey;
}

export async function addTrip(input: TripInput): Promise<string> {
  const ref = await addDoc(tripsCol(), {
    title: input.title.trim().slice(0, 80),
    place: input.place.trim().slice(0, 80),
    startDate: input.startDate,
    endDate: input.endDate,
    days: buildDays(input.startDate, input.endDate),
    createdAt: serverTimestamp(),
  });
  await syncSummary();
  return ref.id;
}

export async function editTrip(id: string, input: TripInput, previousDays: TripDay[]): Promise<void> {
  await updateDoc(doc(getDb(), "trips", id), {
    title: input.title.trim().slice(0, 80),
    place: input.place.trim().slice(0, 80),
    startDate: input.startDate,
    endDate: input.endDate,
    days: buildDays(input.startDate, input.endDate, previousDays),
  });
  await syncSummary();
}

export async function deleteTrip(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), "trips", id));
  await syncSummary();
}

export function saveDays(id: string, days: TripDay[]): Promise<void> {
  return updateDoc(doc(getDb(), "trips", id), { days });
}

export const newStopId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function cleanStop(stop: TripStop): TripStop {
  return { id: stop.id, time: stop.time.slice(0, 5), name: stop.name.trim().slice(0, 80), note: stop.note.trim().slice(0, 200) };
}
