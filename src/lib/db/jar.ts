import { getDb } from "@/lib/firebase/client";
import { addDoc, collection, doc, getDocs, limit, query, serverTimestamp, updateDoc, where, type CollectionReference, type Query } from "@/lib/firebase/fs";
import type { JarDoc } from "@/lib/types";

const jarCol = () => collection(getDb(), "jar") as CollectionReference<JarDoc>;

/** Everything addressed to me (drawn or not), bounded; split client-side. */
export const jarForMe = (uid: string): Query<JarDoc> => query(jarCol(), where("forUid", "==", uid), limit(100));
/** What I've dropped in for them. */
export const jarByMe = (uid: string): Query<JarDoc> => query(jarCol(), where("authorId", "==", uid), limit(100));

export async function addJarNote(authorId: string, forUid: string, text: string): Promise<string> {
  const ref = await addDoc(jarCol(), { authorId, forUid, text: text.trim().slice(0, 500), drawnAt: null, createdAt: serverTimestamp() });
  return ref.id;
}

/** Pick one undrawn note at random and mark it drawn. Returns null when the jar is empty. */
export async function drawJarNote(uid: string): Promise<(JarDoc & { id: string }) | null> {
  const snap = await getDocs(query(jarCol(), where("forUid", "==", uid), where("drawnAt", "==", null), limit(50)));
  if (snap.empty) return null;
  const pick = snap.docs[Math.floor(Math.random() * snap.docs.length)];
  if (pick === undefined) return null;
  await updateDoc(doc(getDb(), "jar", pick.id), { drawnAt: serverTimestamp() });
  return { id: pick.id, ...pick.data() };
}
