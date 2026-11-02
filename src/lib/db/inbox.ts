import { userRef } from "@/lib/db/refs";
import { getDb } from "@/lib/firebase/client";
import { collection, deleteDoc, doc, limit, orderBy, query, serverTimestamp, startAfter, updateDoc, type CollectionReference, type Query, type QueryDocumentSnapshot } from "@/lib/firebase/fs";
import { INBOX_PAGE, markReadPatch } from "@/lib/inbox";
import type { InboxItemDoc } from "@/lib/types";

/** `inbox/{uid}/items`: written by the server with every push it composes, read and deleted by the owner. */
const inboxItemsCol = (uid: string) => collection(getDb(), "inbox", uid, "items") as CollectionReference<InboxItemDoc>;

/** Newest first, a page at a time; the built-in single-field index serves it. */
export function inboxQuery(uid: string, after: QueryDocumentSnapshot<InboxItemDoc> | null): Query<InboxItemDoc> {
  return after
    ? query(inboxItemsCol(uid), orderBy("createdAt", "desc"), startAfter(after), limit(INBOX_PAGE))
    : query(inboxItemsCol(uid), orderBy("createdAt", "desc"), limit(INBOX_PAGE));
}

/** Opening the sheet (and "Mark all read"): zero the badge and stamp the read time. */
export function markInboxRead(uid: string): Promise<void> {
  return updateDoc(userRef(uid), markReadPatch(serverTimestamp()));
}

/** Swipe-to-delete. */
export function deleteInboxItem(uid: string, id: string): Promise<void> {
  return deleteDoc(doc(inboxItemsCol(uid), id));
}
