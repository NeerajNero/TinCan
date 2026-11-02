import { describe, expect, it } from "vitest";

import { formatCountdown, nextSnapStreak, pickSnapMinute, SNAP_EARLIEST_MIN, SNAP_LATEST_MIN, SNAP_WINDOW_MS, snapCardState, snapLateness, snapPinned, snapStreakAfter, snapWindowLeftMs } from "@/lib/snap";

const A = "uid-a";
const B = "uid-b";
const TODAY = "2026-11-02";
const AT = Date.UTC(2026, 10, 2, 9, 0, 0);

describe("daily snap: picking the minute", () => {
  it("is uniform over [09:00, 22:00) and never outside it", () => {
    expect(pickSnapMinute(0)).toBe(SNAP_EARLIEST_MIN);
    expect(pickSnapMinute(0.999999)).toBe(SNAP_LATEST_MIN - 1);
    expect(pickSnapMinute(1)).toBe(SNAP_LATEST_MIN - 1);
    expect(pickSnapMinute(0.5)).toBe(SNAP_EARLIEST_MIN + Math.floor((SNAP_LATEST_MIN - SNAP_EARLIEST_MIN) / 2));
    for (let i = 0; i < 200; i++) {
      const m = pickSnapMinute(i / 200)!;
      expect(m).toBeGreaterThanOrEqual(SNAP_EARLIEST_MIN);
      expect(m).toBeLessThan(SNAP_LATEST_MIN);
    }
  });
  it("a tick that runs late in the day only picks what is left; after 22:00 there is no snap", () => {
    expect(pickSnapMinute(0, 15 * 60)).toBe(15 * 60);
    expect(pickSnapMinute(0.5, 21 * 60 + 30)).toBe(21 * 60 + 45);
    expect(pickSnapMinute(0.5, 22 * 60)).toBeNull();
    expect(pickSnapMinute(0.5, 23 * 60)).toBeNull();
    expect(pickSnapMinute(0.5, 5)).toBe(pickSnapMinute(0.5));
  });
});

describe("daily snap: window and lateness", () => {
  it("counts down inside the two minutes, then is late by whole minutes rounded up", () => {
    expect(snapWindowLeftMs(AT, AT - 1000)).toBe(0);
    expect(snapWindowLeftMs(AT, AT)).toBe(SNAP_WINDOW_MS);
    expect(snapWindowLeftMs(AT, AT + 28_000)).toBe(92_000);
    expect(formatCountdown(92_000)).toBe("1:32");
    expect(formatCountdown(0)).toBe("0:00");
    expect(snapLateness(AT, AT + 119_000)).toEqual({ late: false, lateByMin: 0 });
    expect(snapLateness(AT, AT + SNAP_WINDOW_MS)).toEqual({ late: false, lateByMin: 0 });
    expect(snapLateness(AT, AT + SNAP_WINDOW_MS + 1)).toEqual({ late: true, lateByMin: 1 });
    expect(snapLateness(AT, AT + SNAP_WINDOW_MS + 61_000)).toEqual({ late: true, lateByMin: 2 });
    expect(snapLateness(AT, AT + SNAP_WINDOW_MS + 3 * 60 * 60_000)).toEqual({ late: true, lateByMin: 180 });
  });
});

describe("daily snap: the Home card", () => {
  const schedule = { todayKey: TODAY, todayAt: AT };
  it("hides before the minute, with no schedule, or with yesterday's schedule", () => {
    expect(snapCardState(undefined, null, A, B, TODAY, AT)).toBe("hidden");
    expect(snapCardState(schedule, null, A, B, TODAY, AT - 1)).toBe("hidden");
    expect(snapCardState({ todayKey: "2026-11-01", todayAt: AT - 86_400_000 }, { dateKey: TODAY, posted: { [A]: true } }, A, B, TODAY, AT)).toBe("hidden");
  });
  it("open inside the window, late after it, waiting once I posted, both once both did; only open and late pin", () => {
    expect(snapCardState(schedule, null, A, B, TODAY, AT + 1000)).toBe("open");
    expect(snapCardState(schedule, { dateKey: TODAY, posted: { [B]: true } }, A, B, TODAY, AT + 1000)).toBe("open");
    expect(snapCardState(schedule, null, A, B, TODAY, AT + SNAP_WINDOW_MS + 1)).toBe("late");
    expect(snapCardState(schedule, { dateKey: TODAY, posted: { [A]: true } }, A, B, TODAY, AT + 5000)).toBe("waiting");
    expect(snapCardState(schedule, { dateKey: TODAY, posted: { [A]: true, [B]: true } }, A, B, TODAY, AT + 5000)).toBe("both");
    expect(snapPinned("open")).toBe(true);
    expect(snapPinned("late")).toBe(true);
    expect(snapPinned("waiting")).toBe(false);
    expect(snapPinned("both")).toBe(false);
    expect(snapPinned("hidden")).toBe(false);
  });
});

describe("daily snap: the both-posted streak", () => {
  it("extends on consecutive days, restarts on a gap, keeps best, no-ops on the same day", () => {
    expect(nextSnapStreak(undefined, TODAY)).toEqual({ count: 1, lastDateKey: TODAY, best: 1 });
    expect(nextSnapStreak({ count: 3, lastDateKey: "2026-11-01", best: 5 }, TODAY)).toEqual({ count: 4, lastDateKey: TODAY, best: 5 });
    expect(nextSnapStreak({ count: 5, lastDateKey: "2026-11-01", best: 5 }, TODAY)).toEqual({ count: 6, lastDateKey: TODAY, best: 6 });
    expect(nextSnapStreak({ count: 9, lastDateKey: "2026-10-30", best: 9 }, TODAY)).toEqual({ count: 1, lastDateKey: TODAY, best: 9 });
    const same = { count: 2, lastDateKey: TODAY, best: 2 };
    expect(nextSnapStreak(same, TODAY)).toBe(same);
  });
  it("the transaction writes only when both posted and the day isn't counted yet", () => {
    const uids = [A, B];
    expect(snapStreakAfter(undefined, TODAY, null, uids)).toBeNull(); // none posted
    expect(snapStreakAfter(undefined, TODAY, { posted: { [A]: true } }, uids)).toBeNull(); // one posted
    expect(snapStreakAfter(undefined, TODAY, { posted: { [A]: true, [B]: true } }, uids)).toEqual({ count: 1, lastDateKey: TODAY, best: 1 }); // both
    expect(snapStreakAfter({ count: 1, lastDateKey: TODAY, best: 1 }, TODAY, { posted: { [A]: true, [B]: true } }, uids)).toBeNull(); // already counted
    expect(snapStreakAfter({ count: 1, lastDateKey: "2026-11-01", best: 1 }, TODAY, { posted: { [A]: true, [B]: true } }, uids)).toEqual({ count: 2, lastDateKey: TODAY, best: 2 });
    expect(snapStreakAfter(undefined, TODAY, { posted: { [A]: true, [B]: true } }, [A])).toBeNull(); // pair incomplete
  });
});
