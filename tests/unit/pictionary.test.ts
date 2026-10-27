import { describe, expect, it } from "vitest";

import { advanceRound, pointsFor, ROUND_MS, roundsOf, type RoundState } from "@/lib/pictionary";

const game = (over: Partial<RoundState> = {}): RoundState => ({ players: { first: "a", second: "b" }, status: "active", round: 1, drawerUid: "a", roundOver: true, ...over });

describe("pictionary rounds", () => {
  it("defaults to 3 rounds; only 5 is the other option", () => {
    expect(roundsOf(null)).toBe(3);
    expect(roundsOf({})).toBe(3);
    expect(roundsOf({ rounds: 5 })).toBe(5);
    expect(roundsOf({ rounds: 4 })).toBe(3);
  });

  it("advances one round and swaps the drawer, finishing after the last", () => {
    const next = advanceRound(game(), 1, () => '["x","y","z"]');
    expect(next).toMatchObject({ round: 2, drawerUid: "b", word: null, roundOver: false, strokes: null });
    expect(advanceRound(game({ round: 3, drawerUid: "a" }), 3, () => "[]")).toMatchObject({ status: "finished", open: false });
    expect(advanceRound(game({ round: 3, rounds: 5 }), 3, () => "[]")).toMatchObject({ round: 4 });
    expect(advanceRound(game({ round: 5, rounds: 5 }), 5, () => "[]")).toMatchObject({ status: "finished" });
  });

  it("ignores a stale or double tap instead of skipping a round", () => {
    expect(advanceRound(game({ round: 2 }), 1, () => "[]")).toBeNull(); // already advanced by the other phone
    expect(advanceRound(game({ roundOver: false }), 1, () => "[]")).toBeNull();
    expect(advanceRound(game({ status: "finished" }), 1, () => "[]")).toBeNull();
    expect(advanceRound(null, 1, () => "[]")).toBeNull();
  });

  it("scores by time left, never below 1", () => {
    expect(pointsFor(ROUND_MS)).toBe(10);
    expect(pointsFor(ROUND_MS / 2)).toBe(5);
    expect(pointsFor(0)).toBe(1);
    expect(pointsFor(-5000)).toBe(1);
  });
});
