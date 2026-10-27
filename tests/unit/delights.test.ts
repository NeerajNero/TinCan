import { describe, expect, it } from "vitest";

import { digestLines, digestPush, type DigestInput } from "@/lib/digest";
import { todaysMilestones } from "@/lib/milestones";
import { LOOKBACKS, oneMonthAgo, oneYearAgo } from "@/lib/onThisDay";
import { favouritePing, recapLine } from "@/lib/recap";
import { shareText, wordNumber } from "@/lib/wordle";

const quiet: DigestInput = { yourTurn: 0, invites: 0, jarNotes: 0, dailyUnanswered: false, pet: null, capsulesToday: 0, milestonesToday: [], unread: 0 };

describe("morning digest", () => {
  it("says nothing when there is nothing", () => {
    expect(digestLines(quiet)).toEqual([]);
    expect(digestPush("Neeraj", quiet)).toBeNull();
  });
  it("lists only what exists, in a fixed order", () => {
    const lines = digestLines({ yourTurn: 2, invites: 1, jarNotes: 3, dailyUnanswered: true, pet: { name: "Blob", food: 12, joy: 80 }, capsulesToday: 1, milestonesToday: ["Diwali"], unread: 5 });
    expect(lines).toEqual(["🎲 your turn in 2 games", "🎮 a game invite is waiting", "💬 5 unread messages", "💭 today's question is waiting", "🫙 3 jar notes to draw", "🐾 Blob needs food", "⏳ a time capsule unlocks today", "🎉 Diwali is today"]);
  });
  it("mentions the pet only under 30 and names both needs", () => {
    expect(digestLines({ ...quiet, pet: { name: "Blob", food: 30, joy: 30 } })).toEqual([]);
    expect(digestLines({ ...quiet, pet: { name: "Blob", food: 5, joy: 5 } })).toEqual(["🐾 Blob needs food and a play"]);
  });
  it("builds the push with a dotted body", () => {
    expect(digestPush("Neeraj", { ...quiet, unread: 1, jarNotes: 1 })).toEqual({ title: "☀️ Good morning, Neeraj", body: "💬 1 unread message · 🫙 1 jar note to draw" });
  });
});

describe("monthly recap", () => {
  const base = { monthLabel: "October", uids: ["a", "b"], names: { a: "Neeraj", b: "Shravya" } };
  it("formats the full line", () => {
    expect(recapLine({ ...base, messages: { a: 640, b: 564 }, wins: { a: 7, b: 5 }, draws: 0, stickers: 3, longestStreak: 18, favouritePing: "hug" })).toBe(
      "📊 October: 1,204 messages (Neeraj 640 · Shravya 564) · games 7–5 · 3 stickers · longest streak 18 · favourite ping 🤗",
    );
  });
  it("drops empty parts and shows draws", () => {
    expect(recapLine({ ...base, messages: {}, wins: { a: 1 }, draws: 2, stickers: 0, longestStreak: 0, favouritePing: null })).toBe("📊 October: 0 messages · games 1–0 (2 draws)");
  });
  it("picks the favourite ping from the change since the last recap", () => {
    expect(favouritePing({ hug: 10, wave: 12 }, { hug: 2, wave: 9 })).toBe("hug");
    expect(favouritePing({ hug: 3 }, undefined)).toBe("hug");
    expect(favouritePing({ hug: 3 }, { hug: 3 })).toBeNull();
    expect(favouritePing(undefined, undefined)).toBeNull();
  });
});

describe("share the word grid", () => {
  it("numbers puzzles from the launch day", () => {
    expect(wordNumber("2026-10-17")).toBe(1);
    expect(wordNumber("2026-10-27")).toBe(11);
  });
  it("builds the emoji grid with the count, or X when unsolved", () => {
    expect(shareText("2026-10-27", ["crane", "slate", "plate"], "plate")).toBe("Tincan word #11 3/6\n⬛⬛🟩⬛🟩\n⬛🟩🟩🟩🟩\n🟩🟩🟩🟩🟩");
    const lost = shareText("2026-10-27", ["crane", "crane", "crane", "crane", "crane", "crane"], "plate");
    expect(lost.startsWith("Tincan word #11 X/6\n")).toBe(true);
    expect(lost.split("\n")).toHaveLength(7);
  });
});

describe("on this day", () => {
  it("goes back a year, clamping 29 Feb", () => {
    expect(oneYearAgo("2026-10-27")).toBe("2025-10-27");
    expect(oneYearAgo("2028-02-29")).toBe("2027-02-28");
    expect(oneYearAgo("2029-02-28")).toBe("2028-02-28");
  });
  it("goes back a month, clamping to shorter months and crossing the year", () => {
    expect(oneMonthAgo("2026-10-27")).toBe("2026-09-27");
    expect(oneMonthAgo("2026-03-31")).toBe("2026-02-28");
    expect(oneMonthAgo("2028-03-31")).toBe("2028-02-29");
    expect(oneMonthAgo("2026-05-31")).toBe("2026-04-30");
    expect(oneMonthAgo("2026-01-15")).toBe("2025-12-15");
    expect(oneMonthAgo("2026-07-31")).toBe("2026-06-30");
  });
  it("exposes both look-backs with labels", () => {
    expect(LOOKBACKS.map((l) => [l.label, l.date("2026-10-27")])).toEqual([
      ["1 year ago", "2025-10-27"],
      ["1 month ago", "2026-09-27"],
    ]);
  });
});

describe("milestone mode", () => {
  const preset = { anniversaryLabel: "Friendiversary", emoji: "💛" };
  it("finds yearly milestones and the friendiversary that fall today", () => {
    const summary = [
      { id: "m1", title: "Diwali", emoji: "🪔", date: "2025-10-27", repeatYearly: true },
      { id: "m2", title: "Trip", emoji: "✈️", date: "2026-10-27", repeatYearly: false },
      { id: "m3", title: "Other", emoji: "🎂", date: "2025-11-02", repeatYearly: true },
    ];
    expect(todaysMilestones(summary, "2024-10-27", "2026-10-27", preset).map((u) => u.title)).toEqual(["Diwali", "Trip", "Friendiversary"]);
    expect(todaysMilestones(summary, "2024-10-27", "2026-10-28", preset)).toEqual([]);
  });
});
