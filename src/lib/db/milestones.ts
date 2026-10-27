
import { pairRef } from "@/lib/db/refs";
import { planFestivalImport } from "@/lib/festivals";
import { getDb } from "@/lib/firebase/client";
import { addDoc, collection, deleteDoc, deleteField, doc, getDocs, limit, query, serverTimestamp, updateDoc, writeBatch, type CollectionReference, type Query } from "@/lib/firebase/fs";
import { isEffect, type MilestoneDoc, type MilestoneSummary } from "@/lib/types";

const milestonesCol = () => collection(getDb(), "milestones") as CollectionReference<MilestoneDoc>;
export const milestonesQuery = (): Query<MilestoneDoc> => query(milestonesCol(), limit(100));

export type MilestoneInput = MilestoneDoc;

function clean(input: MilestoneInput): MilestoneDoc {
  return { title: input.title.trim().slice(0, 60), date: input.date, repeatYearly: Boolean(input.repeatYearly), emoji: input.emoji || "🎉", ...(isEffect(input.effect) ? { effect: input.effect } : {}), ...(input.verify === true ? { verify: true } : {}) };
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
  await updateDoc(doc(getDb(), "milestones", id), { ...clean(input), ...(input.verify === true ? {} : { verify: deleteField() }) });
  await syncSummary();
}

/** "Looks right": the date was checked; the summary doesn't carry the flag, so no re-mirror. */
export function clearVerify(id: string): Promise<void> {
  return updateDoc(doc(getDb(), "milestones", id), { verify: deleteField() });
}

/** "Add festivals": import the seed as milestones, skipping ones already present; returns how many were added. */
export async function importFestivals(today: string): Promise<number> {
  const existing = (await getDocs(milestonesQuery())).docs.map((d) => d.data());
  const toAdd = planFestivalImport(existing, today);
  if (toAdd.length === 0) return 0;
  const batch = writeBatch(getDb());
  for (const m of toAdd) batch.set(doc(milestonesCol()), { ...clean(m), createdAt: serverTimestamp() });
  await batch.commit();
  await syncSummary();
  return toAdd.length;
}

export async function deleteMilestone(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), "milestones", id));
  await syncSummary();
}
