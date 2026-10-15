import { addDoc, collection, deleteDoc, doc, limit, query, serverTimestamp, Timestamp, where, type CollectionReference, type Query } from "@/lib/firebase/fs";

import { getDb } from "@/lib/firebase/client";
import type { ScheduledDoc } from "@/lib/types";

export const scheduledCol = () => collection(getDb(), "scheduled") as CollectionReference<ScheduledDoc>;

/** My pending ones; sorted client-side by sendAt (no composite index needed). */
export const pendingScheduled = (uid: string): Query<ScheduledDoc> =>
  query(scheduledCol(), where("senderId", "==", uid), where("sentAt", "==", null), limit(50));

export async function scheduleMessage(senderId: string, text: string, sendAt: Date): Promise<string> {
  const ref = await addDoc(scheduledCol(), {
    senderId,
    text: text.trim().slice(0, 2000),
    sendAt: Timestamp.fromDate(sendAt),
    sentAt: null,
    messageId: null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export function cancelScheduled(id: string): Promise<void> {
  return deleteDoc(doc(getDb(), "scheduled", id));
}
