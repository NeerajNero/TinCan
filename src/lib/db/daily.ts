import { collection, doc, documentId, endBefore, limitToLast, orderBy, query, serverTimestamp, setDoc, type CollectionReference, type DocumentReference, type Query, type QueryDocumentSnapshot } from "firebase/firestore";

import { getDb } from "@/lib/firebase/client";
import { questionIndexFor } from "@/lib/daily";
import type { DailyQuestionDoc, DateKey } from "@/lib/types";

export const HISTORY_PAGE = 30;

export const dailyCol = () => collection(getDb(), "dailyQuestions") as CollectionReference<DailyQuestionDoc>;
export const dailyRef = (dateKey: DateKey) => doc(getDb(), "dailyQuestions", dateKey) as DocumentReference<DailyQuestionDoc>;

/** Write (or rewrite) my answer for a room-day; the friend's key is untouched. */
export function answerDaily(dateKey: DateKey, uid: string, text: string): Promise<void> {
  return setDoc(
    dailyRef(dateKey),
    { questionIndex: questionIndexFor(dateKey), answers: { [uid]: { text: text.trim().slice(0, 1000), at: serverTimestamp() } } },
    { merge: true },
  );
}

/**
 * The newest 30 days. Ids are yyyy-MM-dd, so ascending document-id order is
 * date order; `limitToLast` takes the newest without needing a descending
 * index (Firestore only auto-indexes __name__ ascending). Older pages end
 * before the oldest doc already loaded.
 */
export function historyQuery(before: QueryDocumentSnapshot<DailyQuestionDoc> | null): Query<DailyQuestionDoc> {
  return before
    ? query(dailyCol(), orderBy(documentId()), endBefore(before), limitToLast(HISTORY_PAGE))
    : query(dailyCol(), orderBy(documentId()), limitToLast(HISTORY_PAGE));
}
