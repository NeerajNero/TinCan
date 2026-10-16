import { describe, expect, it } from "vitest";

import { emptyAt, levelFor, MIN_PER_POINT, petStats, statFrom } from "@/lib/pet";
import type { PetDoc } from "@/lib/types";

const HOUR = 60 * 60 * 1000;
const now = Date.UTC(2026, 9, 16, 12, 0, 0);
const pet = (over: Partial<PetDoc> = {}): PetDoc => ({ name: "Momo", species: "blob", hungerAt: now, happyAt: now, sleepAt: 0, level: 1, bornAt: now, ...over });

describe("pet stats are derived from timestamps", () => {
  it("is full right after feeding and empty 24 h later", () => {
    expect(statFrom(now, now)).toBe(100);
    expect(statFrom(now - 12 * HOUR, now)).toBeCloseTo(50, 5);
    expect(statFrom(now - 24 * HOUR, now)).toBe(0);
    expect(statFrom(now - 48 * HOUR, now)).toBe(0);
    expect(statFrom(now + HOUR, now)).toBe(100);
  });

  it("maps 14.4 minutes to one point", () => {
    expect(statFrom(now - MIN_PER_POINT * 60_000, now)).toBeCloseTo(99, 5);
    expect(emptyAt(pet())).toBe(now + 24 * HOUR);
  });

  it("picks the mood from the lowest need, sleeping first", () => {
    expect(petStats(pet(), now).mood).toBe("happy");
    expect(petStats(pet({ hungerAt: now - 20 * HOUR }), now).mood).toBe("hungry");
    expect(petStats(pet({ happyAt: now - 20 * HOUR }), now).mood).toBe("sad");
    const asleep = petStats(pet({ hungerAt: now - 20 * HOUR, sleepAt: now - HOUR }), now);
    expect(asleep.mood).toBe("sleeping");
    expect(asleep.wakesAt).toBe(now - HOUR + 8 * HOUR);
    expect(petStats(pet({ sleepAt: now - 9 * HOUR }), now).sleeping).toBe(false);
  });

  it("levels up every seven streak days", () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(6)).toBe(1);
    expect(levelFor(7)).toBe(2);
    expect(levelFor(21)).toBe(4);
    expect(levelFor(-3)).toBe(1);
  });
});
