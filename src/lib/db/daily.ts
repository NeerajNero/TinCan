import { questionIndexFor } from "@/lib/daily";
import { getDb } from "@/lib/firebase/client";
import { collection, doc, limit, orderBy, query, serverTimestamp, setDoc, startAfter, type CollectionReference, type DocumentReference, type Query, type QueryDocumentSnapshot } from "@/lib/firebase/fs";
import type { DailyQuestionDoc, DateKey } from "@/lib/types";

export const HISTORY_PAGE = 30;

const dailyCol = () => collection(getDb(), "dailyQuestions") as CollectionReference<DailyQuestionDoc>;
export const dailyRef = (dateKey: DateKey) => doc(getDb(), "dailyQuestions", dateKey) as DocumentReference<DailyQuestionDoc>;

/** Write (or rewrite) my answer for a room-day; the friend's key is untouched. */
export function answerDaily(dateKey: DateKey, uid: string, text: string): Promise<void> {
  return setDoc(
    dailyRef(dateKey),
    { questionIndex: questionIndexFor(dateKey), dateKey, answers: { [uid]: { text: text.trim().slice(0, 1000), at: serverTimestamp() } } },
    { merge: true },
  );
}

/** Older docs predate the dateKey field; stamp it so they appear in history. */
export function backfillDateKey(dateKey: DateKey): Promise<void> {
  return setDoc(dailyRef(dateKey), { dateKey }, { merge: true });
}

/** Newest day first, ordered by the dateKey field (auto-indexed both ways). */
export function historyQuery(after: QueryDocumentSnapshot<DailyQuestionDoc> | null): Query<DailyQuestionDoc> {
  return after
    ? query(dailyCol(), orderBy("dateKey", "desc"), startAfter(after), limit(HISTORY_PAGE))
    : query(dailyCol(), orderBy("dateKey", "desc"), limit(HISTORY_PAGE));
}
