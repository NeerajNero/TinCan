/**
 * Trivia duel. The round (questions, answers, scores) lives in Firestore
 * trivia/{id}; live mode keeps the shared cursor at RTDB trivia/{id}.
 */
import { onValue, ref, runTransaction, update } from "firebase/database";
import { addDoc, collection, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, Timestamp, updateDoc, type CollectionReference, type DocumentReference } from "firebase/firestore";

import { getDb, getRtdb } from "@/lib/firebase/client";
import { randomSeed } from "@/lib/seeded";
import { pickQuestionIds, totalScore, type TriviaAnswer } from "@/lib/trivia";

export type TriviaMode = "live" | "async";

export interface TriviaRoundDoc {
  seed: number;
  questionIds: number[];
  players: string[];
  mode: TriviaMode;
  createdBy: string;
  /** uid → answers once that person finishes. */
  answers: Record<string, TriviaAnswer[]>;
  scores: Record<string, number>;
  startedAt: Timestamp | null;
  /** Set by whoever finishes second. */
  finishedAt: Timestamp | null;
}

export interface LiveCursor {
  /** Current question index. */
  qIndex: number;
  /** Epoch ms when the current question started. */
  qStartedAt: number;
  /** uid → chosen index for the current question (-1 timeout). */
  answered?: Record<string, number>;
}

export const triviaCol = () => collection(getDb(), "trivia") as CollectionReference<TriviaRoundDoc>;
export const triviaRef = (id: string) => doc(getDb(), "trivia", id) as DocumentReference<TriviaRoundDoc>;
const liveRef = (id: string) => ref(getRtdb(), `trivia/${id}`);

export async function createRound(createdBy: string, players: string[], mode: TriviaMode): Promise<string> {
  const seed = randomSeed();
  const ref = await addDoc(triviaCol(), {
    seed,
    questionIds: pickQuestionIds(seed),
    players,
    mode,
    createdBy,
    answers: {},
    scores: {},
    startedAt: serverTimestamp(),
    finishedAt: null,
  });
  if (mode === "live") await setDoc(doc(getDb(), "trivia", ref.id), {}, { merge: true });
  return ref.id;
}

/** Latest rounds for the lobby (bounded). */
export async function recentRounds(): Promise<Array<TriviaRoundDoc & { id: string }>> {
  const snap = await getDocs(query(triviaCol(), orderBy("startedAt", "desc"), limit(10)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** My completed answers → doc; the second finisher stamps finishedAt. */
export async function submitAnswers(id: string, uid: string, answers: TriviaAnswer[], otherDone: boolean): Promise<void> {
  await updateDoc(triviaRef(id), {
    [`answers.${uid}`]: answers,
    [`scores.${uid}`]: totalScore(answers),
    ...(otherDone ? { finishedAt: serverTimestamp() } : {}),
  });
}

/* ── live cursor ───────────────────────────────────────────────────────── */

export function subscribeLive(id: string, cb: (c: LiveCursor | null) => void): () => void {
  return onValue(liveRef(id), (snap) => cb(snap.exists() ? (snap.val() as LiveCursor) : null));
}

export function startLive(id: string): Promise<void> {
  return update(liveRef(id), { qIndex: 0, qStartedAt: Date.now(), answered: null });
}

export function answerLive(id: string, uid: string, choice: number): Promise<void> {
  return update(liveRef(id), { [`answered/${uid}`]: choice });
}

/** Advance when both answered or the clock ran out; a transaction keeps both clients in step. */
export function advanceLive(id: string, fromIndex: number, total: number): Promise<void> {
  return runTransaction(liveRef(id), (cur: LiveCursor | null) => {
    if (!cur || cur.qIndex !== fromIndex) return cur;
    if (cur.qIndex + 1 >= total) return { ...cur, qIndex: total, qStartedAt: Date.now(), answered: null };
    return { qIndex: cur.qIndex + 1, qStartedAt: Date.now(), answered: null };
  }).then(() => undefined);
}
