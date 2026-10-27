import { describe, expect, it } from "vitest";

import type { WordleDoc } from "@/lib/db/wordle";
import { wordFor } from "@/lib/wordle";
import { bothFinished, groupWordleDays, guessCount, iRecordWordle, settledDays, windowStats, wordleDayWinner, wordleMoves, wordleResultLine } from "@/lib/wordleResults";

const at = (ms: number) => ({ toMillis: () => ms }) as unknown as WordleDoc["at"];
const solved = (n: number, ms = 0): WordleDoc => ({ guesses: Array.from({ length: n }, () => "crane"), solved: true, done: true, at: at(ms) });
const failed = (): WordleDoc => ({ guesses: Array.from({ length: 6 }, () => "crane"), solved: false, done: true, at: at(0) });
const partial = (n: number): WordleDoc => ({ guesses: Array.from({ length: n }, () => "crane"), solved: false, done: false, at: at(0) });

describe("daily word results", () => {
  it("fewer guesses wins, same count or neither solved is a draw, a solve beats a fail", () => {
    expect(wordleDayWinner("a", "b", solved(3), solved(5))).toBe("a");
    expect(wordleDayWinner("a", "b", solved(5), solved(3))).toBe("b");
    expect(wordleDayWinner("a", "b", solved(4), solved(4))).toBeNull();
    expect(wordleDayWinner("a", "b", failed(), failed())).toBeNull();
    expect(wordleDayWinner("a", "b", failed(), solved(6))).toBe("b");
    expect(wordleDayWinner("a", "b", solved(6), failed())).toBe("a");
  });

  it("counts guesses only for a solve", () => {
    expect(guessCount(solved(2))).toBe(2);
    expect(guessCount(failed())).toBeNull();
    expect(guessCount(partial(3))).toBeNull();
    expect(guessCount(undefined)).toBeNull();
  });

  it("a day settles only when both are done", () => {
    expect(bothFinished(solved(3), failed())).toBe(true);
    expect(bothFinished(solved(3), partial(2))).toBe(false);
    expect(bothFinished(null, solved(3))).toBe(false);
  });

  it("the later finisher records; ties go to the lower uid; pending timestamps wait", () => {
    expect(iRecordWordle("a", "b", 200, 100)).toBe(true);
    expect(iRecordWordle("a", "b", 100, 200)).toBe(false);
    expect(iRecordWordle("a", "b", 100, 100)).toBe(true);
    expect(iRecordWordle("b", "a", 100, 100)).toBe(false);
    expect(iRecordWordle("a", "b", null, 100)).toBe(false);
    expect(iRecordWordle("a", "b", 100, null)).toBe(false);
  });

  it("stores the winning guess count as moves, a full grid when nobody solved it", () => {
    expect(wordleMoves(solved(3), solved(5))).toBe(3);
    expect(wordleMoves(failed(), solved(4))).toBe(4);
    expect(wordleMoves(failed(), failed())).toBe(6);
  });

  it("writes a friendly chat line for each outcome", () => {
    expect(wordleResultLine("Sam", solved(3), solved(5))).toBe("🟩 Sam won the daily word in 3");
    expect(wordleResultLine("Sam", failed(), solved(6))).toBe("🟩 Sam won the daily word in 6");
    expect(wordleResultLine(null, solved(4), solved(4))).toBe("🟩 The daily word was a tie — 4 guesses each");
    expect(wordleResultLine(null, failed(), failed())).toBe("🟩 Today's word beat you both");
  });

  it("groups {dateKey}_{uid} rows into days, newest first, with the day's word", () => {
    const days = groupWordleDays([
      { id: "2026-10-25_a", data: solved(3) },
      { id: "2026-10-26_b", data: solved(2) },
      { id: "2026-10-25_b", data: failed() },
      { id: "garbage", data: solved(1) },
      { id: "2026-10-26_", data: solved(1) },
    ]);
    expect(days.map((d) => d.dateKey)).toEqual(["2026-10-26", "2026-10-25"]);
    expect(days[0]?.word).toBe(wordFor("2026-10-26"));
    expect(Object.keys(days[0]?.docs ?? {})).toEqual(["b"]);
    expect(Object.keys(days[1]?.docs ?? {}).sort()).toEqual(["a", "b"]);
    expect(settledDays(days, "a", "b").map((d) => d.dateKey)).toEqual(["2026-10-25"]);
  });

  it("window stats: played counts any guess, average over solves only, one decimal", () => {
    const days = groupWordleDays([
      { id: "2026-10-24_a", data: solved(3) },
      { id: "2026-10-25_a", data: solved(4) },
      { id: "2026-10-26_a", data: failed() },
      { id: "2026-10-27_a", data: { guesses: [], solved: false, done: false, at: null } },
      { id: "2026-10-26_b", data: partial(2) },
    ]);
    expect(windowStats(days, "a")).toEqual({ played: 3, solved: 2, avg: 3.5 });
    expect(windowStats(days, "b")).toEqual({ played: 1, solved: 0, avg: null });
    expect(windowStats(days, "nobody")).toEqual({ played: 0, solved: 0, avg: null });
  });
});
