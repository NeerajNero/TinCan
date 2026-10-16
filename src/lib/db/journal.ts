import { getDb } from "@/lib/firebase/client";
import { addDoc, collection, deleteDoc, doc, limit, orderBy, query, serverTimestamp, startAfter, updateDoc, type CollectionReference, type Query, type QueryDocumentSnapshot } from "@/lib/firebase/fs";
import type { JournalDoc, MediaItem } from "@/lib/types";

export const JOURNAL_PAGE = 20;
const JOURNAL_MAX = 4000;

const journalCol = () => collection(getDb(), "journal") as CollectionReference<JournalDoc>;

export function journalQuery(after: QueryDocumentSnapshot<JournalDoc> | null): Query<JournalDoc> {
  return after
    ? query(journalCol(), orderBy("createdAt", "desc"), startAfter(after), limit(JOURNAL_PAGE))
    : query(journalCol(), orderBy("createdAt", "desc"), limit(JOURNAL_PAGE));
}

export async function addJournalEntry(authorId: string, text: string, mood: string, media: MediaItem[]): Promise<string> {
  const ref = await addDoc(journalCol(), { authorId, text: text.trim().slice(0, JOURNAL_MAX), mood, media, createdAt: serverTimestamp() });
  return ref.id;
}

export function editJournalEntry(id: string, text: string, mood: string): Promise<void> {
  return updateDoc(doc(getDb(), "journal", id), { text: text.trim().slice(0, JOURNAL_MAX), mood, editedAt: serverTimestamp() });
}

export function deleteJournalEntry(id: string): Promise<void> {
  return deleteDoc(doc(getDb(), "journal", id));
}
