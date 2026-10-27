/** Daily word docs at wordle/{dateKey}_{uid}: own-write, both-read. Results settle into gameResults + pair.records.word. */
import { createSystemMessage } from "@/lib/chat/system";
import { addDays, dayUserId } from "@/lib/dates";
import { pairRef, userRef } from "@/lib/db/refs";
import { getDb } from "@/lib/firebase/client";
import { collection, doc, documentId, endBefore, getDocs, increment, limit, orderBy, query, runTransaction, serverTimestamp, setDoc, startAt, Timestamp, updateDoc, type CollectionReference, type DocumentReference } from "@/lib/firebase/fs";
import { swallow } from "@/lib/swallow";
import type { PairDoc } from "@/lib/types";
import { bothFinished, groupWordleDays, settledDays, wordleDayWinner, wordleMoves, wordleResultLine, type WordleDay } from "@/lib/wordleResults";
export interface WordleDoc {
  guesses: string[];
  solved: boolean;
  /** Finished (solved or out of guesses). */
  done: boolean;
  at: Timestamp | null;
}

const wordleCol = () => collection(getDb(), "wordle") as CollectionReference<WordleDoc>;
export const wordleRef = (dateKey: string, uid: string) => doc(wordleCol(), dayUserId(dateKey, uid)) as DocumentReference<WordleDoc>;

export async function saveGuesses(dateKey: string, uid: string, guesses: string[], solved: boolean, done: boolean): Promise<void> {
  await setDoc(wordleRef(dateKey, uid), { guesses, solved, done, at: serverTimestamp() });
  if (solved) await updateDoc(userRef(uid), { wordleSolved: increment(1) }).catch(swallow);
}

/** How many days History shows (two docs per day). */
export const HISTORY_DAYS = 30;
/** The one-time catch-up when the scoreboard is first created: this many docs back. */
const BACKFILL_DOCS = 200;

/**
 * Past days only, newest first, one bounded read. Ids sort as `{dateKey}_{uid}`,
 * so the window is an ascending document-id range from `since` (inclusive)
 * up to `before` (exclusive): `orderBy(documentId())` ascending is the
 * built-in index; descending `__name__` needs a composite index Firestore
 * refuses with failed-precondition, so never order by id descending.
 * Without `since` (the first-settle catch-up) the oldest `maxDocs` are read.
 */
export async function loadWordleHistory(before: string, since: string | null = addDays(before, -HISTORY_DAYS), maxDocs = HISTORY_DAYS * 2): Promise<WordleDay[]> {
  const bounds = since ? [startAt(since), endBefore(before)] : [endBefore(before)];
  const snap = await getDocs(query(wordleCol(), orderBy(documentId()), ...bounds, limit(maxDocs)));
  return groupWordleDays(snap.docs.map((d) => ({ id: d.id, data: d.data() })));
}

interface WordleResultRow {
  game: "word";
  players: string[];
  winnerId: string | null;
  endReason: "win" | "draw";
  startedAt: Timestamp;
  endedAt: Timestamp | ReturnType<typeof serverTimestamp>;
  moves: number;
}

function resultRow(day: WordleDay, me: string, friend: string, endedAt: WordleResultRow["endedAt"]): WordleResultRow {
  const mine = day.docs[me]!;
  const theirs = day.docs[friend]!;
  const winnerId = wordleDayWinner(me, friend, mine, theirs);
  const ats = [mine.at, theirs.at].filter((t): t is Timestamp => t !== null).map((t) => t.toMillis());
  return { game: "word", players: [me, friend], winnerId, endReason: winnerId ? "win" : "draw", startedAt: Timestamp.fromMillis(ats.length ? Math.min(...ats) : Date.now()), endedAt, moves: wordleMoves(mine, theirs) };
}

/**
 * Record a day both of you finished: `gameResults/word-{dateKey}` (create-once,
 * so a second phone or a re-open is a no-op), `pair.records.word` and the chat
 * line. The first time ever, earlier days are folded in too (no chat lines for
 * those). Returns whether this call created the row.
 */
export async function settleWordleDay(day: WordleDay, me: string, friend: string, pair: Pick<PairDoc, "records">, nameOf: (uid: string) => string): Promise<boolean> {
  const mine = day.docs[me];
  const theirs = day.docs[friend];
  if (!mine || !theirs || !bothFinished(mine, theirs)) return false;
  const results = collection(getDb(), "gameResults");
  const todayRef = doc(results, `word-${day.dateKey}`);
  const backfill = pair.records?.word === undefined ? settledDays(await loadWordleHistory(day.dateKey, null, BACKFILL_DOCS), me, friend) : [];

  const created = await runTransaction(getDb(), async (tx) => {
    if ((await tx.get(todayRef)).exists()) return false;
    const pairSnap = await tx.get(pairRef());
    const records = { ...(pairSnap.data()?.records ?? {}) };
    const rec = { ...(records.word ?? {}) };
    const tally = (winnerId: string | null) => {
      if (winnerId) rec[winnerId] = (rec[winnerId] ?? 0) + 1;
      else rec.draws = (rec.draws ?? 0) + 1;
    };
    if (records.word === undefined) {
      for (const past of backfill) {
        const row = resultRow(past, me, friend, Timestamp.fromMillis(Math.max(...[past.docs[me]!.at, past.docs[friend]!.at].map((t) => t?.toMillis() ?? 0))));
        tx.set(doc(results, `word-${past.dateKey}`), row);
        tally(row.winnerId);
      }
    }
    const row = resultRow(day, me, friend, serverTimestamp());
    tx.set(todayRef, row);
    tally(row.winnerId);
    records.word = rec;
    tx.update(pairRef(), { records });
    return true;
  }).catch((): boolean => false);

  if (created) {
    const winnerId = wordleDayWinner(me, friend, mine, theirs);
    createSystemMessage("game-result", wordleResultLine(winnerId ? nameOf(winnerId) : null, mine, theirs), { game: "Daily word" }).catch(swallow);
  }
  return created;
}
