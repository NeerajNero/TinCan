
import { pairRef } from "@/lib/db/refs";
import { getDb } from "@/lib/firebase/client";
import { addDoc, collection, deleteDoc, doc, getDocs, limit, query, serverTimestamp, updateDoc, type CollectionReference, type Query } from "@/lib/firebase/fs";
import type { MilestoneDoc, MilestoneSummary } from "@/lib/types";

const milestonesCol = () => collection(getDb(), "milestones") as CollectionReference<MilestoneDoc>;
export const milestonesQuery = (): Query<MilestoneDoc> => query(milestonesCol(), limit(100));

export type MilestoneInput = MilestoneDoc;

function clean(input: MilestoneInput): MilestoneDoc {
  return { title: input.title.trim().slice(0, 60), date: input.date, repeatYearly: Boolean(input.repeatYearly), emoji: input.emoji || "🎉" };
}

/**
 * Mirror the (small) collection onto pair/main so Home can show "next up"
 * without another listener. Called after every write.
 */
async function syncSummary(): Promise<void> {
  const snap = await getDocs(milestonesQuery());
  const summary: MilestoneSummary[] = snap.docs
    .map((d) => ({ id: d.id, ...clean(d.data()) }))
    .slice(0, 50);
  await updateDoc(pairRef(), { milestonesSummary: summary });
}

export async function addMilestone(input: MilestoneInput): Promise<string> {
  const ref = await addDoc(milestonesCol(), { ...clean(input), createdAt: serverTimestamp() });
  await syncSummary();
  return ref.id;
}

export async function editMilestone(id: string, input: MilestoneInput): Promise<void> {
  await updateDoc(doc(getDb(), "milestones", id), clean(input));
  await syncSummary();
}

export async function deleteMilestone(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), "milestones", id));
  await syncSummary();
}
