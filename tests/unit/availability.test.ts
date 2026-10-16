import { describe, expect, it } from "vitest";

import { intersect, projectWeek, remapToZone, slotIndex, slotLabel, toWindows } from "@/lib/availability";
import type { AvailabilityDoc } from "@/lib/types";

const KOLKATA = "Asia/Kolkata"; // UTC+5:30
const LONDON = "Europe/London"; // UTC+1 in October (BST)
const now = new Date("2026-10-12T06:00:00Z"); // Monday

const doc = (slots: AvailabilityDoc["slots"]): Pick<AvailabilityDoc, "slots"> => ({ slots });

describe("slot labels", () => {
  it("round-trips", () => {
    expect(slotLabel(0)).toBe("00:00");
    expect(slotLabel(19)).toBe("09:30");
    expect(slotIndex("09:30")).toBe(19);
    expect(slotIndex("23:00")).toBe(46);
  });
});

describe("overlap across time zones", () => {
  it("finds the shared half hours when each person paints in their own zone", () => {
    // 21:00–22:00 IST on Monday == 16:30–17:30 BST on Monday.
    const a = projectWeek(doc({ mon: ["21:00", "21:30"] }), KOLKATA, now, 2);
    const b = projectWeek(doc({ mon: ["16:00", "16:30", "17:00"] }), LONDON, now, 2);
    const shared = intersect(a, b);
    expect(shared).toHaveLength(2);
    expect(new Date(shared[0]!.start).toISOString()).toBe("2026-10-12T15:30:00.000Z");
    const windows = toWindows(shared, now);
    expect(windows).toHaveLength(1);
    expect(windows[0]!.slots).toBe(2);
  });

  it("handles a slot that crosses midnight after conversion", () => {
    // 02:00 IST on Tuesday is 21:30 BST on Monday: the friend's Tuesday slot lands on my Monday.
    const remapped = remapToZone(doc({ tue: ["02:00"] }), KOLKATA, LONDON, now);
    expect(remapped.mon?.has(slotIndex("21:30"))).toBe(true);
    expect(remapped.tue).toBeUndefined();
  });

  it("drops windows that have already ended", () => {
    const past = projectWeek(doc({ mon: ["00:00"] }), "UTC", now, 1); // 00:00 UTC Monday, before `now`
    expect(toWindows(past, now)).toHaveLength(0);
  });
});
