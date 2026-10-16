import { getDb } from "@/lib/firebase/client";
import { doc, serverTimestamp, setDoc, type DocumentReference } from "@/lib/firebase/fs";
import type { AvailabilityDoc, WeekdayKey } from "@/lib/types";

export const availabilityRef = (uid: string) => doc(getDb(), "availability", uid) as DocumentReference<AvailabilityDoc>;

export function saveAvailability(uid: string, tz: string, slots: Partial<Record<WeekdayKey, string[]>>): Promise<void> {
  return setDoc(availabilityRef(uid), { slots, tz, updatedAt: serverTimestamp() });
}
