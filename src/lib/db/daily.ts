import { collection, doc, documentId, limit, orderBy, query, serverTimestamp, setDoc, startAfter, type CollectionReference, type DocumentReference, type Query, type QueryDocumentSnapshot } from "firebase/firestore";

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

/** Newest day first; ids are yyyy-MM-dd so document-id order is date order. */
export function historyQuery(after: QueryDocumentSnapshot<DailyQuestionDoc> | null): Query<DailyQuestionDoc> {
  const base = [orderBy(documentId(), "desc"), limit(HISTORY_PAGE)];
  return after ? query(dailyCol(), orderBy(documentId(), "desc"), startAfter(after), limit(HISTORY_PAGE)) : query(dailyCol(), ...base);
}
