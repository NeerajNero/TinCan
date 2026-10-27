import { describe, expect, it } from "vitest";

import { alreadyPresent, datesToVerify, FESTIVALS, festivalMilestones, firstSundayOfAugust, planFestivalImport, type FestivalSeed } from "@/lib/festivals";
import { effectFor, petAccessoryFor, verifyDueIn } from "@/lib/milestones";
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
      { title: "Diwali", emoji: "🪔", effect: "diyas", date: "2027-10-29", repeatYearly: false, verify: true },
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

describe("verify-date reminder (7 days ahead)", () => {
  const ms = (date: string, repeatYearly = false, verify = true) => ({ date, repeatYearly, verify });
  it("picks one-offs exactly 7 days out, across a month boundary", () => {
    expect(verifyDueIn([ms("2026-11-01"), ms("2026-10-31"), ms("2026-11-02")], "2026-10-25").map((m) => m.nextDate)).toEqual(["2026-11-01"]);
    expect(verifyDueIn([ms("2027-01-01")], "2026-12-25").map((m) => m.nextDate)).toEqual(["2027-01-01"]);
    expect(verifyDueIn([ms("2026-03-07")], "2026-02-28").map((m) => m.nextDate)).toEqual(["2026-03-07"]);
    expect(verifyDueIn([ms("2028-03-06")], "2028-02-28").map((m) => m.nextDate)).toEqual(["2028-03-06"]); // leap year
  });
  it("uses the next occurrence of yearly items, including across the year end", () => {
    expect(verifyDueIn([ms("2020-11-01", true)], "2026-10-25")).toHaveLength(1);
    expect(verifyDueIn([ms("2020-01-03", true)], "2026-12-27")[0]?.nextDate).toBe("2027-01-03");
    expect(verifyDueIn([ms("2020-10-20", true)], "2026-10-25")).toEqual([]); // this year's already passed, next is 360 days off
  });
  it("ignores unmarked milestones and other distances", () => {
    expect(verifyDueIn([ms("2026-11-01", false, false), { date: "2026-11-01", repeatYearly: false }], "2026-10-25")).toEqual([]);
    expect(verifyDueIn([ms("2026-11-01")], "2026-10-26")).toEqual([]);
    expect(verifyDueIn([ms("2026-11-01")], "2026-10-25", 6)).toEqual([]);
  });
  it("the import marks the seed's verify years", () => {
    const plan = planFestivalImport([], "2026-01-01", seed, years);
    expect(plan.find((m) => m.title === "Diwali" && m.date === "2027-10-29")?.verify).toBe(true);
    expect(plan.find((m) => m.title === "Diwali" && m.date === "2026-11-08")?.verify).toBeUndefined();
  });
});
