/**
 * Trivia duel. The round (questions, answers, scores) lives in Firestore
 * trivia/{id}; live mode keeps the shared cursor at RTDB trivia/{id}.
 *
 * Live handshake (phase 21): each player's client writes `joined/{uid}` as
 * soon as its listener has its first snapshot, and whichever client first
 * sees both players joined starts the round in a transaction (idempotent:
 * once `qIndex` exists nobody starts it again). Nothing waits for the host.
 * Every function takes the database instances as trailing parameters so the
 * emulator test (`tests/trivia-live.test.ts`) can drive two real clients.
 */
import { firebaseErrorCode } from "@/lib/diagLog";
import { getDb, getRtdb } from "@/lib/firebase/client";
import { addDoc, collection, doc, getDocs, limit, orderBy, query, serverTimestamp, Timestamp, updateDoc, type CollectionReference, type DocumentReference, type Firestore } from "@/lib/firebase/fs";
import { onValue, ref, remove, runTransaction, update, type Database } from "@/lib/firebase/rt";
import { randomSeed } from "@/lib/seeded";
import { LIVE_COUNTDOWN_MS, pickQuestionIds, totalScore, type TriviaAnswer } from "@/lib/trivia";

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

/** RTDB trivia/{id}. `joined` appears first; `qIndex` once the round has started. */
interface LiveCursor {
  /** Current question index; absent before the start, ROUND_SIZE when done. */
  qIndex?: number;
  /** Epoch ms when the current question starts (the first one after a short countdown). */
  qStartedAt?: number;
  startedBy?: string;
  /** uid → epoch ms when that player's client joined the live session. */
  joined?: Record<string, number>;
  /** uid → chosen index for the current question (-1 timeout). */
  answered?: Record<string, number>;
}

const triviaCol = (db: Firestore) => collection(db, "trivia") as CollectionReference<TriviaRoundDoc>;
export const triviaRef = (id: string, db: Firestore = getDb()) => doc(db, "trivia", id) as DocumentReference<TriviaRoundDoc>;
const liveRef = (id: string, rtdb: Database) => ref(rtdb, `trivia/${id}`);

export async function createRound(createdBy: string, players: string[], mode: TriviaMode, db: Firestore = getDb()): Promise<string> {
  const seed = randomSeed();
  const created = await addDoc(triviaCol(db), {
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
  return created.id;
}

/** Latest rounds for the lobby (bounded). */
export async function recentRounds(): Promise<Array<TriviaRoundDoc & { id: string }>> {
  const snap = await getDocs(query(triviaCol(getDb()), orderBy("startedAt", "desc"), limit(10)));
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

/** Give up on live mode: the round becomes async and the live node goes away. */
export async function switchToAsync(id: string, db: Firestore = getDb(), rtdb: Database = getRtdb()): Promise<void> {
  await updateDoc(triviaRef(id, db), { mode: "async" });
  await remove(liveRef(id, rtdb));
}

/* ── live session ──────────────────────────────────────────────────────── */

export type LiveStatus =
  /** No snapshot yet. */
  | { phase: "connecting" }
  /** Connected and joined; the other player hasn't joined. */
  | { phase: "waiting"; cursor: LiveCursor }
  /** Both joined and the round has started (a countdown runs until `qStartedAt`). */
  | { phase: "playing"; cursor: LiveCursor; qIndex: number }
  /** A read or write the backend refused, or the node vanished mid-round (switched to async). */
  | { phase: "error"; code: string };

const liveStatusOf = (cursor: LiveCursor | null): LiveStatus => {
  if (cursor && typeof cursor.qIndex === "number") return { phase: "playing", cursor, qIndex: cursor.qIndex };
  return { phase: "waiting", cursor: cursor ?? {} };
};

const everyoneJoined = (cursor: LiveCursor | null, players: readonly string[]): boolean => players.every((p) => typeof cursor?.joined?.[p] === "number");

/**
 * Join the live session at trivia/{id} and report its status until stopped.
 * Joins on the first snapshot, starts the round (once, transactionally) when
 * both players are in, and reports a rules rejection instead of hanging.
 */
export function openLiveSession(id: string, uid: string, players: readonly string[], onChange: (s: LiveStatus) => void, rtdb: Database = getRtdb()): () => void {
  const node = liveRef(id, rtdb);
  let joined = false;
  let starting = false;
  let stopped = false;
  let sawNode = false;
  const fail = (err: unknown) => {
    if (!stopped) onChange({ phase: "error", code: firebaseErrorCode(err) });
  };
  const unsub = onValue(
    node,
    (snap) => {
      if (stopped) return;
      const cur = snap.exists() ? (snap.val() as LiveCursor) : null;
      if (cur) sawNode = true;
      else if (sawNode) return fail({ code: "live-node-removed" });
      if (!joined) {
        joined = true;
        update(node, { [`joined/${uid}`]: Date.now() }).catch(fail);
      }
      if (cur && typeof cur.qIndex !== "number" && everyoneJoined(cur, players) && !starting) {
        starting = true;
        // Server truth only: both clients race here, and an optimistic local start that the
        // server then rejects leaves that phone's view stale until the next write.
        runTransaction(
          node,
          (data: LiveCursor | null) => {
            if (!data || typeof data.qIndex === "number") return undefined; // abort: already started (or not cached yet)
            return { ...data, qIndex: 0, qStartedAt: Date.now() + LIVE_COUNTDOWN_MS, startedBy: uid, answered: null };
          },
          { applyLocally: false },
        ).catch(fail);
      }
      onChange(liveStatusOf(cur));
    },
    fail,
  );
  return () => {
    stopped = true;
    unsub();
  };
}

export function answerLive(id: string, uid: string, choice: number, rtdb: Database = getRtdb()): Promise<void> {
  return update(liveRef(id, rtdb), { [`answered/${uid}`]: choice });
}

/** Advance when both answered or the clock ran out; a transaction keeps both clients in step. */
export function advanceLive(id: string, fromIndex: number, total: number, rtdb: Database = getRtdb()): Promise<void> {
  return runTransaction(
    liveRef(id, rtdb),
    (cur: LiveCursor | null) => {
      if (!cur || cur.qIndex !== fromIndex) return undefined; // abort: someone else advanced first
      const next = cur.qIndex + 1 >= total ? total : cur.qIndex + 1;
      return { ...cur, qIndex: next, qStartedAt: Date.now(), answered: null };
    },
    { applyLocally: false },
  ).then(() => undefined);
}
