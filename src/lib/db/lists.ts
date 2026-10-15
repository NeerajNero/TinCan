import { addDoc, collection, deleteDoc, doc, limit, orderBy, query, serverTimestamp, updateDoc, where, writeBatch, type CollectionReference, type Query } from "@/lib/firebase/fs";

import { getDb } from "@/lib/firebase/client";
import type { ListItemDoc, ListKind } from "@/lib/types";

export const LIST_META: Record<ListKind, { emoji: string; title: string; blurb: string }> = {
  bucket: { emoji: "🪣", title: "Bucket list", blurb: "Things to do together, someday" },
  wishlist: { emoji: "🌠", title: "Wishlist", blurb: "Little wants, big wants" },
  gifts: { emoji: "🎁", title: "Gift ideas", blurb: "Only you can see these" },
  todo: { emoji: "✅", title: "To-do", blurb: "Shared chores and errands" },
};

export const itemsCol = (kind: ListKind) => collection(getDb(), "lists", kind, "items") as CollectionReference<ListItemDoc>;

/** One bounded listener; gift ideas are filtered to the author (the rules require it). */
export function itemsQuery(kind: ListKind, uid: string): Query<ListItemDoc> {
  return kind === "gifts"
    ? query(itemsCol(kind), where("addedBy", "==", uid), limit(200))
    : query(itemsCol(kind), orderBy("order", "asc"), limit(200));
}

export async function addItem(kind: ListKind, uid: string, text: string, order: number): Promise<string> {
  const ref = await addDoc(itemsCol(kind), { text: text.trim().slice(0, 200), note: "", url: "", addedBy: uid, done: false, doneAt: null, order, createdAt: serverTimestamp() });
  return ref.id;
}

export function editItem(kind: ListKind, id: string, changes: Partial<Pick<ListItemDoc, "text" | "note" | "url">>): Promise<void> {
  return updateDoc(doc(getDb(), "lists", kind, "items", id), {
    ...(changes.text !== undefined ? { text: changes.text.trim().slice(0, 200) } : {}),
    ...(changes.note !== undefined ? { note: changes.note.trim().slice(0, 300) } : {}),
    ...(changes.url !== undefined ? { url: changes.url.trim().slice(0, 500) } : {}),
  });
}

export function setDone(kind: ListKind, id: string, done: boolean): Promise<void> {
  return updateDoc(doc(getDb(), "lists", kind, "items", id), { done, doneAt: done ? serverTimestamp() : null });
}

export function deleteItem(kind: ListKind, id: string): Promise<void> {
  return deleteDoc(doc(getDb(), "lists", kind, "items", id));
}

/** Persist a new order for the ids given (0..n), only touching docs whose order changed. */
export async function reorderItems(kind: ListKind, orderedIds: string[], current: Map<string, number>): Promise<void> {
  const batch = writeBatch(getDb());
  let writes = 0;
  orderedIds.forEach((id, i) => {
    if (current.get(id) !== i) {
      batch.update(doc(getDb(), "lists", kind, "items", id), { order: i });
      writes++;
    }
  });
  if (writes) await batch.commit();
}
