/**
 * Daily word results and history, pure: who won a day, the chat line, who
 * records it, and grouping stored docs into days. `lib/db/wordle` does the I/O.
 */
import type { WordleDoc } from "@/lib/db/wordle";
import { MAX_GUESSES, wordFor } from "@/lib/wordle";

/** A finished-or-not attempt as read from `wordle/{dateKey}_{uid}`. */
export type Attempt = Pick<WordleDoc, "guesses" | "solved" | "done">;

/** One room day with whatever each of you wrote (absent = didn't play). */
export interface WordleDay {
  dateKey: string;
  word: string;
  docs: Record<string, WordleDoc>;
}

/** Guesses to solve, or null for not solved. */
export const guessCount = (a: Attempt | undefined): number | null => (a?.solved ? a.guesses.length : null);

/** Both finished: fewer guesses wins, same count (or neither solved) is a draw. */
export function wordleDayWinner(a: string, b: string, docA: Attempt, docB: Attempt): string | null {
  const ca = guessCount(docA);
  const cb = guessCount(docB);
  if (ca === cb) return null;
  if (ca === null) return b;
  if (cb === null) return a;
  return ca < cb ? a : b;
}

/** Both of you finished today. */
export const bothFinished = (a: Attempt | null | undefined, b: Attempt | null | undefined): boolean => Boolean(a?.done && b?.done);

/**
 * Exactly one phone records a day: the one that finished last (its write
 * made the comparison possible), with the lower uid breaking a tie. Both
 * timestamps must be server-confirmed first.
 */
export function iRecordWordle(me: string, friend: string, mineAt: number | null, theirsAt: number | null): boolean {
  if (mineAt === null || theirsAt === null) return false;
  if (mineAt !== theirsAt) return mineAt > theirsAt;
  return me < friend;
}

/** The `moves` stored on the result row: the winning guess count, else the shared one, else a full grid. */
export function wordleMoves(docA: Attempt, docB: Attempt): number {
  const counts = [guessCount(docA), guessCount(docB)].filter((n): n is number => n !== null);
  return counts.length ? Math.min(...counts) : MAX_GUESSES;
}

/** The chat line for a settled day. */
export function wordleResultLine(winnerName: string | null, docA: Attempt, docB: Attempt): string {
  const ca = guessCount(docA);
  const cb = guessCount(docB);
  if (winnerName) return `🟩 ${winnerName} won the daily word in ${Math.min(ca ?? Infinity, cb ?? Infinity)}`;
  if (ca === null && cb === null) return "🟩 Today's word beat you both";
  return `🟩 The daily word was a tie — ${ca} guesses each`;
}

/** Group `wordle` rows (id `{dateKey}_{uid}`) into days, newest first. */
export function groupWordleDays(rows: Array<{ id: string; data: WordleDoc }>): WordleDay[] {
  const byDay = new Map<string, WordleDay>();
  for (const { id, data } of rows) {
    const cut = id.indexOf("_");
    if (cut !== 10) continue;
    const dateKey = id.slice(0, cut);
    const uid = id.slice(cut + 1);
    if (!uid) continue;
    const day = byDay.get(dateKey) ?? { dateKey, word: wordFor(dateKey), docs: {} };
    day.docs[uid] = data;
    byDay.set(dateKey, day);
  }
  return [...byDay.values()].sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
}

/** Days both of you finished — the only ones that count on the scoreboard. */
export const settledDays = (days: WordleDay[], me: string, friend: string): WordleDay[] => days.filter((d) => bothFinished(d.docs[me], d.docs[friend]));

export interface WindowStats {
  played: number;
  solved: number;
  /** Mean guesses over solved days, one decimal, or null. */
  avg: number | null;
}

/** Per-person figures over a window of days. */
export function windowStats(days: WordleDay[], uid: string): WindowStats {
  let played = 0;
  let solved = 0;
  let total = 0;
  for (const d of days) {
    const doc = d.docs[uid];
    if (!doc || doc.guesses.length === 0) continue;
    played += 1;
    const n = guessCount(doc);
    if (n !== null) {
      solved += 1;
      total += n;
    }
  }
  return { played, solved, avg: solved ? Math.round((total / solved) * 10) / 10 : null };
}
