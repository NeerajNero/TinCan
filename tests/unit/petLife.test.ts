import { describe, expect, it } from "vitest";

import { sinceFor, statFrom } from "@/lib/pet";
import { BURST_TAPS, BURST_WINDOW_MS, capParticles, heldHappiness, MAX_PARTICLES, PET_POINTS_PER_SEC, petEvents, pickReaction, REACTIONS, tapBurst, writeKey } from "@/lib/petLife";
import type { PetDoc } from "@/lib/types";

const now = Date.UTC(2026, 9, 16, 12, 0, 0);
const pet = (over: Partial<PetDoc> = {}): PetDoc => ({ name: "Momo", species: "blob", hungerAt: now, happyAt: now, sleepAt: 0, level: 1, bornAt: now, ...over });

describe("tap reactions", () => {
  it("has ten reactions and never repeats the previous one", () => {
    expect(REACTIONS).toHaveLength(10);
    let prev = pickReaction(null);
    for (let i = 0; i < 500; i++) {
      const next = pickReaction(prev);
      expect(next).not.toBe(prev);
      prev = next;
    }
  });

  it("covers the whole pool, including the edge of the random range", () => {
    const seen = new Set(Array.from({ length: 10 }, (_, i) => pickReaction(null, () => i / 10)));
    expect(seen.size).toBe(10);
    expect(pickReaction("bounce", () => 0.9999)).not.toBe("bounce");
  });

  it("turns three taps inside two seconds into a burst", () => {
    let taps: number[] = [];
    for (const at of [0, 600]) {
      const r = tapBurst(taps, now + at);
      expect(r.excited).toBe(false);
      taps = r.taps;
    }
    expect(tapBurst(taps, now + 1200).excited).toBe(true);
    expect(BURST_TAPS).toBe(3);
    // Spread out, old taps fall out of the window.
    expect(tapBurst([now, now + 100], now + BURST_WINDOW_MS + 200)).toEqual({ taps: [now + BURST_WINDOW_MS + 200], excited: false });
  });

  it("keeps at most 20 particles alive, newest first to stay", () => {
    const alive = Array.from({ length: 18 }, (_, i) => i);
    const out = capParticles(alive, [100, 101, 102, 103]);
    expect(out).toHaveLength(MAX_PARTICLES);
    expect(out.slice(-4)).toEqual([100, 101, 102, 103]);
    expect(out[0]).toBe(2);
  });
});

describe("long-press petting", () => {
  it("tops happiness up gradually, never past one Play's worth", () => {
    expect(heldHappiness(40, 0)).toBe(40);
    expect(heldHappiness(40, 1000)).toBe(40 + PET_POINTS_PER_SEC);
    expect(heldHappiness(40, 60_000)).toBe(100);
    expect(heldHappiness(40, -50)).toBe(40);
  });

  it("writes a timestamp that reads back as the topped-up value", () => {
    for (const v of [0, 37.5, 80, 100]) expect(statFrom(sinceFor(v, now), now)).toBeCloseTo(v, 6);
    expect(sinceFor(150, now)).toBe(now);
  });
});

describe("friend's pet actions", () => {
  const never = () => false;

  it("names each change", () => {
    expect(petEvents(pet(), pet({ hungerAt: now + 1 }), never)).toEqual(["feed"]);
    expect(petEvents(pet(), pet({ happyAt: now + 1 }), never)).toEqual(["play"]);
    expect(petEvents(pet(), pet({ sleepAt: now + 1 }), never)).toEqual(["sleep"]);
    expect(petEvents(pet({ sleepAt: now }), pet(), never)).toEqual(["wake"]);
    expect(petEvents(pet(), pet(), never)).toEqual([]);
  });

  it("skips values this device wrote", () => {
    const mine = new Set([writeKey("hungerAt", now + 5)]);
    expect(petEvents(pet(), pet({ hungerAt: now + 5 }), (k) => mine.has(k))).toEqual([]);
    // A petting write can move happyAt back in time: not a play.
    expect(petEvents(pet(), pet({ happyAt: now - 10 }), never)).toEqual([]);
  });
});
