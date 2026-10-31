import { describe, expect, it } from "vitest";

import { createTurnTimer, formatMs, formatTurn, turnLabel, turnLine } from "@/lib/turnTiming";

function clock() {
  let t = 1000;
  let wall = 1_700_000_000_000;
  return { now: () => t, wall: () => wall, tick: (ms: number) => { t += ms; wall += ms; } };
}

describe("turn timer", () => {
  it("times a tap to the node reflecting it (moves grew), once", () => {
    const c = clock();
    const timer = createTurnTimer(c.now, c.wall);
    timer.start({ gameId: "g1", kind: "shot", game: "battleship", mode: "server", moves: 4 });
    expect(timer.observe("g1", 4)).toBeNull(); // an unrelated snapshot (same moves) is not the result
    c.tick(1240);
    const t = timer.observe("g1", 5);
    expect(t).toEqual({ kind: "shot", game: "battleship", mode: "server", ms: 1240, at: 1_700_000_001_240 });
    expect(timer.observe("g1", 6)).toBeNull(); // the opponent's move later is not timed
    expect(timer.last()).toEqual(t);
  });
  it("ignores other games, cancelled taps and stale taps", () => {
    const c = clock();
    const timer = createTurnTimer(c.now, c.wall);
    timer.start({ gameId: "g1", kind: "move", game: "chess", mode: "local", moves: 0 });
    c.tick(50);
    expect(timer.observe("g2", 9)).toBeNull();
    timer.cancel("g2");
    timer.cancel("g1");
    expect(timer.observe("g1", 1)).toBeNull();
    timer.start({ gameId: "g1", kind: "move", game: "chess", mode: "local", moves: 1 });
    c.tick(31_000);
    expect(timer.observe("g1", 2)).toBeNull();
    expect(timer.list()).toEqual([]);
  });
  it("a later tap replaces an unfinished one and the list keeps the last ten", () => {
    const c = clock();
    const timer = createTurnTimer(c.now, c.wall);
    for (let i = 0; i < 12; i++) {
      timer.start({ gameId: "g", kind: "move", game: "dots", mode: "local", moves: i });
      c.tick(100 + i);
      timer.observe("g", i + 1);
    }
    expect(timer.list()).toHaveLength(10);
    expect(timer.list()[0]?.ms).toBe(102);
    timer.start({ gameId: "g", kind: "guess", game: "hangman", mode: "server", moves: 12 });
    timer.start({ gameId: "g", kind: "guess", game: "hangman", mode: "server", moves: 12 });
    c.tick(180);
    expect(timer.observe("g", 13)?.ms).toBe(180);
  });
  it("formats for Diagnostics", () => {
    const t = { kind: "shot" as const, game: "battleship", mode: "server" as const, ms: 1240, at: Date.UTC(2026, 9, 31, 11, 33, 4) };
    expect(turnLabel(t)).toBe("Last shot");
    expect(formatTurn(t)).toBe("1,240 ms (battleship, server)");
    expect(formatTurn({ ...t, kind: "move", game: "chess", mode: "local", ms: 180 })).toBe("180 ms (chess, local)");
    expect(formatMs(1234567)).toBe("1,234,567");
    expect(turnLine(t)).toBe("shot battleship server 1240 ms 2026-10-31T11:33:04.000Z");
  });
});
