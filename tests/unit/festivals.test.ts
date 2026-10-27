import { describe, expect, it } from "vitest";

import { alreadyPresent, datesToVerify, FESTIVALS, festivalMilestones, firstSundayOfAugust, planFestivalImport, type FestivalSeed } from "@/lib/festivals";
import { effectFor, petAccessoryFor } from "@/lib/milestones";
import { EFFECTS, isEffect } from "@/lib/types";

const seed: FestivalSeed[] = [
  { id: "independence", title: "Independence Day", emoji: "🇮🇳", effect: "confetti", fixed: "08-15" },
  { id: "diwali", title: "Diwali", emoji: "🪔", effect: "diyas", dates: { "2026": "2026-11-08", "2027": "2027-10-29" }, verify: ["2027"] },
  { id: "friendship", title: "Friendship Day", emoji: "🤝", effect: "confetti", rule: "first-sunday-august" },
];
const years = ["2026", "2027"] as const;

describe("festival import", () => {
  it("fixed-date festivals become one repeat-yearly milestone, moveable ones one per year", () => {
    const list = festivalMilestones(seed, years);
    expect(list).toEqual([
      { title: "Independence Day", emoji: "🇮🇳", effect: "confetti", date: "2026-08-15", repeatYearly: true },
      { title: "Diwali", emoji: "🪔", effect: "diyas", date: "2026-11-08", repeatYearly: false },
      { title: "Diwali", emoji: "🪔", effect: "diyas", date: "2027-10-29", repeatYearly: false },
      { title: "Friendship Day", emoji: "🤝", effect: "confetti", date: "2026-08-02", repeatYearly: false },
      { title: "Friendship Day", emoji: "🤝", effect: "confetti", date: "2027-08-01", repeatYearly: false },
    ]);
  });
  it("computes the first Sunday of August", () => {
    expect(firstSundayOfAugust(2026)).toBe("2026-08-02");
    expect(firstSundayOfAugust(2027)).toBe("2027-08-01");
    expect(firstSundayOfAugust(2028)).toBe("2028-08-06");
  });
  it("skips festivals already present (yearly by month-day, one-offs by date; title case-insensitive) and past one-offs", () => {
    const existing = [
      { title: "independence day", date: "2024-08-15", repeatYearly: true },
      { title: "Diwali", date: "2026-11-08", repeatYearly: false },
    ];
    expect(planFestivalImport(existing, "2026-10-28", seed, years).map((m) => `${m.title} ${m.date}`)).toEqual(["Diwali 2027-10-29", "Friendship Day 2027-08-01"]);
    expect(alreadyPresent([{ title: "Diwali", date: "2025-11-08", repeatYearly: true }], { title: "Diwali", date: "2026-11-08", repeatYearly: false, emoji: "", effect: "diyas" })).toBe(false);
  });
  it("adds nothing when everything is there", () => {
    const all = festivalMilestones(seed, years).map(({ title, date, repeatYearly }) => ({ title, date, repeatYearly }));
    expect(planFestivalImport(all, "2026-01-01", seed, years)).toEqual([]);
  });
  it("the real seed has every effect valid, three years for moveable festivals, and lists the dates to verify", () => {
    for (const f of FESTIVALS) {
      expect(isEffect(f.effect), f.id).toBe(true);
      if (!f.fixed && !f.rule) expect(Object.keys(f.dates ?? {}), f.id).toEqual(["2026", "2027", "2028"]);
    }
    expect(FESTIVALS).toHaveLength(12);
    const verify = datesToVerify();
    expect(verify.length).toBeGreaterThan(10);
    expect(verify.some((v) => v.title === "Diwali" && v.date === "2027-10-29")).toBe(true);
    expect(verify.some((v) => v.date.startsWith("2026") && v.title !== "Eid al-Fitr")).toBe(false);
  });
});

describe("festival effects", () => {
  it("picks the first milestone's effect, defaulting to confetti, and maps the pet accessory", () => {
    expect(effectFor([{}, { effect: "snow" }])).toBe("snow");
    expect(effectFor([{}])).toBe("confetti");
    expect(EFFECTS.map(petAccessoryFor)).toEqual(["diya", "colours", "santa", "party", "party", "party", "party"]);
  });
});
