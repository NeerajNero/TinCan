import { describe, expect, it } from "vitest";

import { addDays, dateKeyIn, daysBetween, previousDay, roomDateKey } from "@/lib/dates";
import { nextStreak } from "@/lib/streak";

const ROOM_TZ = "Asia/Kolkata"; // UTC+5:30, no DST

describe("dateKey in ROOM_TZ", () => {
  it("rolls over at local midnight, not UTC midnight", () => {
    const beforeMidnight = new Date("2026-10-15T18:29:00Z"); // 23:59 IST on the 15th
    const afterMidnight = new Date("2026-10-15T18:30:00Z"); // 00:00 IST on the 16th
    expect(dateKeyIn(ROOM_TZ, beforeMidnight)).toBe("2026-10-15");
    expect(dateKeyIn(ROOM_TZ, afterMidnight)).toBe("2026-10-16");
    expect(dateKeyIn("UTC", afterMidnight)).toBe("2026-10-15");
    expect(roomDateKey({ roomTz: ROOM_TZ }, afterMidnight)).toBe("2026-10-16");
  });

  it("does whole-day arithmetic on keys", () => {
    expect(previousDay("2026-03-01")).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(daysBetween("2026-10-10", "2026-10-16")).toBe(6);
  });
});

describe("streak transitions", () => {
  it("starts at 1 with no history", () => {
    expect(nextStreak(undefined, "2026-10-16")).toMatchObject({ count: 1, lastDateKey: "2026-10-16" });
  });
  it("extends across midnight when yesterday counted", () => {
    expect(nextStreak({ count: 4, lastDateKey: "2026-10-15" }, "2026-10-16")).toMatchObject({ count: 5, lastDateKey: "2026-10-16" });
  });
  it("restarts after a missed day", () => {
    expect(nextStreak({ count: 9, lastDateKey: "2026-10-14" }, "2026-10-16")).toMatchObject({ count: 1, lastDateKey: "2026-10-16" });
  });
  it("is a no-op when today is already counted (second client)", () => {
    const prev = { count: 3, lastDateKey: "2026-10-16" };
    expect(nextStreak(prev, "2026-10-16")).toBe(prev);
  });
  it("extends across a month and year boundary", () => {
    expect(nextStreak({ count: 1, lastDateKey: "2026-12-31" }, "2027-01-01").count).toBe(2);
  });
});
