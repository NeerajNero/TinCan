/** Daily word docs at wordle/{dateKey}_{uid}: own-write, both-read. */
import { doc, increment, serverTimestamp, setDoc, updateDoc, type DocumentReference } from "firebase/firestore";
import type { Timestamp } from "firebase/firestore";

import { userRef } from "@/lib/db/refs";
import { dayUserId } from "@/lib/dates";
import { getDb } from "@/lib/firebase/client";

export interface WordleDoc {
  guesses: string[];
  solved: boolean;
  /** Finished (solved or out of guesses). */
  done: boolean;
  at: Timestamp | null;
}

export const wordleRef = (dateKey: string, uid: string) => doc(getDb(), "wordle", dayUserId(dateKey, uid)) as DocumentReference<WordleDoc>;

export async function saveGuesses(dateKey: string, uid: string, guesses: string[], solved: boolean, done: boolean): Promise<void> {
  await setDoc(wordleRef(dateKey, uid), { guesses, solved, done, at: serverTimestamp() });
  if (solved) await updateDoc(userRef(uid), { wordleSolved: increment(1) }).catch(() => undefined);
}
