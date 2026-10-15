/** Know-me quizzes at Firestore quizzes/{id}. */
import { addDoc, collection, deleteDoc, doc, limit, orderBy, query, serverTimestamp, updateDoc, where, type CollectionReference, type Query } from "@/lib/firebase/fs";
import type { Timestamp } from "@/lib/firebase/fs";

import { getDb } from "@/lib/firebase/client";

export interface QuizQuestion {
  q: string;
  answer: string;
  decoys: string[];
}

export interface QuizTaken {
  score: number;
  answers: number[];
  at: Timestamp | null;
}

export interface QuizDoc {
  authorId: string;
  title: string;
  questions: QuizQuestion[];
  status: "draft" | "published";
  takenBy: Record<string, QuizTaken>;
  createdAt: Timestamp | null;
}

export const MIN_QUESTIONS = 5;
export const MAX_QUIZ_QUESTIONS = 10;

export const quizzesCol = () => collection(getDb(), "quizzes") as CollectionReference<QuizDoc>;

/** Published quizzes by the friend (the Play badge filters out ones I've taken). */
export const quizzesFrom = (authorId: string): Query<QuizDoc> => query(quizzesCol(), where("authorId", "==", authorId), where("status", "==", "published"), limit(5));
export const recentQuizzes = (): Query<QuizDoc> => query(quizzesCol(), orderBy("createdAt", "desc"), limit(20));

export async function createQuiz(authorId: string, title: string, questions: QuizQuestion[], publish: boolean): Promise<string> {
  const ref = await addDoc(quizzesCol(), { authorId, title: title.trim().slice(0, 60), questions: questions.map(cleanQ), status: publish ? "published" : "draft", takenBy: {}, createdAt: serverTimestamp() });
  return ref.id;
}

export function updateQuiz(id: string, title: string, questions: QuizQuestion[], publish: boolean): Promise<void> {
  return updateDoc(doc(getDb(), "quizzes", id), { title: title.trim().slice(0, 60), questions: questions.map(cleanQ), status: publish ? "published" : "draft" });
}

export function deleteQuiz(id: string): Promise<void> {
  return deleteDoc(doc(getDb(), "quizzes", id));
}

export function submitQuiz(id: string, uid: string, answers: number[], score: number): Promise<void> {
  return updateDoc(doc(getDb(), "quizzes", id), { [`takenBy.${uid}`]: { score, answers, at: serverTimestamp() } });
}

function cleanQ(q: QuizQuestion): QuizQuestion {
  return { q: q.q.trim().slice(0, 160), answer: q.answer.trim().slice(0, 80), decoys: q.decoys.map((d) => d.trim().slice(0, 80)) };
}
