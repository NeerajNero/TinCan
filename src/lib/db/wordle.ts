/** Daily word docs at wordle/{dateKey}_{uid}: own-write, both-read. */
import { dayUserId } from "@/lib/dates";
import { userRef } from "@/lib/db/refs";
import { getDb } from "@/lib/firebase/client";
import { doc, increment, serverTimestamp, setDoc, updateDoc, type DocumentReference } from "@/lib/firebase/fs";
import type { Timestamp } from "@/lib/firebase/fs";
import { swallow } from "@/lib/swallow";
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
  if (solved) await updateDoc(userRef(uid), { wordleSolved: increment(1) }).catch(swallow);
}
