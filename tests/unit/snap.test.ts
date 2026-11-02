import { describe, expect, it } from "vitest";

import { formatCountdown, nextSnapStreak, pickSnapMinute, SNAP_EARLIEST_MIN, SNAP_LATEST_MIN, SNAP_WINDOW_MS, snapCardState, snapPinned, snapStreakAfter, snapTakeoverDue, snapTiming, snapWindowLeftMs } from "@/lib/snap";

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

describe("daily snap: the prompt's two minutes", () => {
  it("counts down to the deadline; a post before it is on time, after it (or with no deadline) later", () => {
    const deadline = AT + SNAP_WINDOW_MS;
    expect(snapWindowLeftMs(deadline, AT)).toBe(SNAP_WINDOW_MS);
    expect(snapWindowLeftMs(deadline, AT + 28_000)).toBe(92_000);
    expect(snapWindowLeftMs(deadline, deadline + 1)).toBe(0);
    expect(formatCountdown(92_000)).toBe("1:32");
    expect(formatCountdown(0)).toBe("0:00");
    expect(snapTiming(deadline, AT + 119_000)).toEqual({ onTime: true, later: false });
    expect(snapTiming(deadline, deadline)).toEqual({ onTime: true, later: false });
    expect(snapTiming(deadline, deadline + 1)).toEqual({ onTime: false, later: true });
    expect(snapTiming(null, AT)).toEqual({ onTime: false, later: true });
  });
});

describe("daily snap: the Home card", () => {
  const schedule = { todayKey: TODAY, todayAt: AT };
  it("hides before the minute, with no schedule, or with yesterday's schedule", () => {
    expect(snapCardState(undefined, null, A, B, TODAY, AT)).toBe("hidden");
    expect(snapCardState(schedule, null, A, B, TODAY, AT - 1)).toBe("hidden");
    expect(snapCardState({ todayKey: "2026-11-01", todayAt: AT - 86_400_000 }, { dateKey: TODAY, posted: { [A]: true } }, A, B, TODAY, AT)).toBe("hidden");
  });
  it("due once the minute has come, waiting once I posted, both once both did; only due pins", () => {
    expect(snapCardState(schedule, null, A, B, TODAY, AT)).toBe("due");
    expect(snapCardState(schedule, { dateKey: TODAY, posted: { [B]: true } }, A, B, TODAY, AT + 3 * 3_600_000)).toBe("due");
    expect(snapCardState(schedule, { dateKey: TODAY, posted: { [A]: true } }, A, B, TODAY, AT + 5000)).toBe("waiting");
    expect(snapCardState(schedule, { dateKey: TODAY, posted: { [A]: true, [B]: true } }, A, B, TODAY, AT + 5000)).toBe("both");
    expect(snapPinned("due")).toBe(true);
    expect(snapPinned("waiting")).toBe(false);
    expect(snapPinned("both")).toBe(false);
    expect(snapPinned("hidden")).toBe(false);
  });
});

describe("daily snap: the takeover on open", () => {
  const schedule = { todayKey: TODAY, todayAt: AT };
  const base = { schedule, summary: null, uid: A, today: TODAY, now: AT, dismissedFor: null };
  it("shows once the minute has come and my entry is missing", () => {
    expect(snapTakeoverDue({ ...base, now: AT - 1 })).toBe(false); // before todayAt
    expect(snapTakeoverDue(base)).toBe(true); // at the minute
    expect(snapTakeoverDue({ ...base, now: AT + 6 * 3_600_000 })).toBe(true); // hours later, still unposted
    expect(snapTakeoverDue({ ...base, summary: { posted: { [B]: true } } })).toBe(true); // only the friend posted
  });
  it("never shows once posted, after a dismissal today, without a schedule, or for yesterday's minute", () => {
    expect(snapTakeoverDue({ ...base, summary: { posted: { [A]: true } } })).toBe(false);
    expect(snapTakeoverDue({ ...base, dismissedFor: TODAY })).toBe(false);
    expect(snapTakeoverDue({ ...base, schedule: undefined })).toBe(false);
    expect(snapTakeoverDue({ ...base, schedule: { todayKey: "2026-11-01", todayAt: AT - 86_400_000 } })).toBe(false);
  });
  it("a dismissal only lasts the day: the next room day prompts again", () => {
    expect(snapTakeoverDue({ ...base, dismissedFor: "2026-11-01" })).toBe(true);
    expect(snapTakeoverDue({ ...base, today: "2026-11-03", schedule: { todayKey: "2026-11-03", todayAt: AT + 86_400_000 }, now: AT + 86_400_000 + 60_000, dismissedFor: TODAY })).toBe(true);
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
