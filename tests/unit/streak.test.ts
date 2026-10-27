import { describe, expect, it } from "vitest";

import { isStreakWilted, MAX_SHIELDS, nextStreak, shieldSavedToday } from "@/lib/streak";

describe("streak shields", () => {
  it("earns a shield at 7 and 14, capped at 3", () => {
    const six = { count: 6, lastDateKey: "2026-10-16", shields: 0 };
    const seven = nextStreak(six, "2026-10-17");
    expect(seven).toMatchObject({ count: 7, shields: 1, best: 7, monthBest: 7, shieldUsedOn: null });
    expect(nextStreak({ count: 13, lastDateKey: "2026-10-16", shields: 1 }, "2026-10-17").shields).toBe(2);
    expect(nextStreak({ count: 20, lastDateKey: "2026-10-16", shields: 3 }, "2026-10-17").shields).toBe(MAX_SHIELDS);
    expect(nextStreak({ count: 7, lastDateKey: "2026-10-16", shields: 1 }, "2026-10-17").shields).toBe(1); // 8: nothing new
  });

  it("consumes a shield on a one-day gap and keeps counting", () => {
    const next = nextStreak({ count: 9, lastDateKey: "2026-10-14", shields: 2, best: 9 }, "2026-10-16");
    expect(next).toMatchObject({ count: 10, lastDateKey: "2026-10-16", shields: 1, shieldUsedOn: "2026-10-15", best: 10 });
    expect(shieldSavedToday(next, "2026-10-16")).toBe(true);
    expect(shieldSavedToday(next, "2026-10-17")).toBe(false);
  });

  it("restarts on a two-day gap even with shields, and without a shield on a one-day gap", () => {
    expect(nextStreak({ count: 9, lastDateKey: "2026-10-13", shields: 3 }, "2026-10-16")).toMatchObject({ count: 1, shields: 3, shieldUsedOn: null });
    expect(nextStreak({ count: 9, lastDateKey: "2026-10-14", shields: 0 }, "2026-10-16")).toMatchObject({ count: 1, shields: 0, shieldUsedOn: null });
  });

  it("tracks best and monthBest, and a restart keeps best", () => {
    const restarted = nextStreak({ count: 18, lastDateKey: "2026-10-10", best: 18, monthBest: 18 }, "2026-10-16");
    expect(restarted).toMatchObject({ count: 1, best: 18, monthBest: 18 });
    expect(nextStreak({ count: 18, lastDateKey: "2026-10-15", best: 18, monthBest: 4 }, "2026-10-16")).toMatchObject({ count: 19, best: 19, monthBest: 19 });
  });

  it("a shielded gap earns at a multiple of 7 as usual", () => {
    expect(nextStreak({ count: 6, lastDateKey: "2026-10-14", shields: 1 }, "2026-10-16")).toMatchObject({ count: 7, shields: 1, shieldUsedOn: "2026-10-15" });
  });

  it("the plant treats a shielded day as not missed", () => {
    expect(isStreakWilted({ count: 3, lastDateKey: "2026-10-14", shields: 1 }, "2026-10-16")).toBe(false);
    expect(isStreakWilted({ count: 3, lastDateKey: "2026-10-14", shields: 0 }, "2026-10-16")).toBe(true);
    expect(isStreakWilted({ count: 3, lastDateKey: "2026-10-13", shields: 3 }, "2026-10-16")).toBe(true);
    expect(isStreakWilted({ count: 3, lastDateKey: "2026-10-15" }, "2026-10-16")).toBe(false);
    expect(isStreakWilted(undefined, "2026-10-16")).toBe(false);
  });
});
