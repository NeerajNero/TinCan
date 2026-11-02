/**
 * Phase 29: Plan → Upcoming. The agenda merge and grouping (events +
 * milestones + festivals + trips, multi-day spans, ROOM_TZ day boundaries),
 * the one countdown selector Plan and Home share, and the mirrored
 * `pair.nextCountdown` summary the event writer maintains.
 */
import { describe, expect, it } from "vitest";

import { daysBetween, roomDateKey } from "@/lib/dates";
import { festivalMilestones } from "@/lib/festivals";
import type { MilestoneSummary, PairDoc, TripSummary } from "@/lib/types";
import { buildAgenda, busyEvent, cleanEvent, countdownSummaryFrom, dayHeading, eventLine, nearestCountdown, summaryChanged, UPCOMING_MAX_DAYS, type EventWithId } from "@/lib/upcoming";

const PRESET = { anniversaryLabel: "Friendiversary", emoji: "🫶" };
const ME = "uid-me";
const FRIEND = "uid-friend";
const TODAY = "2026-11-10";

const ev = (id: string, over: Partial<EventWithId> = {}): EventWithId => ({
  id,
  title: `Event ${id}`,
  date: TODAY,
  who: "both",
  note: "",
  countdown: false,
  createdBy: ME,
  createdAt: null,
  ...over,
});
const agenda = (over: Partial<Parameters<typeof buildAgenda>[0]> = {}) =>
  buildAgenda({ events: [], milestones: [], friendsSince: null, preset: PRESET, trips: [], from: TODAY, days: 30, today: TODAY, ...over });

describe("buildAgenda", () => {
  it("merges events, milestones, the friendiversary, trips and un-imported festivals into days, soonest first", () => {
    const milestones: MilestoneSummary[] = [{ id: "m1", title: "Mum's birthday", emoji: "🎂", date: "1970-11-12", repeatYearly: true }];
    const trips: TripSummary[] = [{ id: "t1", title: "Goa", place: "Goa", startDate: "2026-11-20", endDate: "2026-11-22" }];
    const days = agenda({ events: [ev("a", { date: "2026-11-11", time: "09:00" }), ev("b", { date: "2026-11-11" })], milestones, friendsSince: "2019-11-15", trips });
    expect(days.map((d) => d.date)).toEqual(["2026-11-11", "2026-11-12", "2026-11-15", "2026-11-20", "2026-11-21", "2026-11-22"]);
    // All-day rows before timed ones.
    expect(days[0]!.items.map((i) => i.id)).toEqual(["b", "a"]);
    expect(days[1]!.items[0]).toMatchObject({ source: "milestone", title: "Mum's birthday", who: "both" });
    expect(days[2]!.items[0]).toMatchObject({ source: "milestone", id: "friends-since", title: "Friendiversary" });
    expect(days[3]!.items[0]).toMatchObject({ source: "trip", title: "Goa", note: "Goa", spanLabel: "Day 1 of 3" });
    expect(days[5]!.items[0]!.spanLabel).toBe("Day 3 of 3");
  });

  it("a multi-day event gets one row per day inside the window, labelled, and nothing outside it", () => {
    const days = agenda({ events: [ev("exam", { date: "2026-11-08", endDate: "2026-11-12", who: ME })], days: 2 });
    expect(days.map((d) => d.date)).toEqual(["2026-11-10", "2026-11-11"]);
    expect(days[0]!.items[0]).toMatchObject({ spanLabel: "Day 3 of 5", who: ME, startDate: "2026-11-08", endDate: "2026-11-12" });
    expect(days[1]!.items[0]!.spanLabel).toBe("Day 4 of 5");
  });

  it("marks today, drops days with nothing, and clamps the window", () => {
    const days = agenda({ events: [ev("x"), ev("y", { date: "2027-06-01" })], days: 10_000 });
    expect(days[0]).toMatchObject({ date: TODAY, isToday: true });
    expect(days.at(-1)!.date <= "2027-12-31").toBe(true);
    expect(days.every((d) => d.items.length > 0)).toBe(true);
    expect(UPCOMING_MAX_DAYS).toBe(400);
  });

  it("shows seed festivals that are not milestones yet, and hides the ones already imported", () => {
    const soon = festivalMilestones()
      .filter((f) => !f.repeatYearly && f.date > TODAY)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    expect(soon, "the seed has a moveable festival ahead of the fixture date").toBeTruthy();
    const days = daysBetween(TODAY, soon!.date) + 1;
    const fresh = agenda({ days }).flatMap((d) => d.items).filter((i) => i.source === "festival");
    expect(fresh.some((i) => i.title === soon!.title && i.date === soon!.date)).toBe(true);
    const imported = agenda({ days, milestones: [{ id: "f", title: soon!.title, emoji: "✨", date: soon!.date, repeatYearly: false }] }).flatMap((d) => d.items);
    expect(imported.filter((i) => i.title === soon!.title)).toHaveLength(1);
    expect(imported.find((i) => i.title === soon!.title)!.source).toBe("milestone");
  });

  it("yearly milestones recur inside a long window, 29 Feb falls back to the 28th", () => {
    const days = agenda({ from: "2027-02-01", today: "2027-02-01", days: 400, milestones: [{ id: "leap", title: "Leap", emoji: "🐸", date: "2024-02-29", repeatYearly: true }] });
    expect(days.flatMap((d) => d.items).filter((i) => i.id === "leap").map((i) => i.date)).toEqual(["2027-02-28", "2028-02-29"]);
  });

  it("uses ROOM_TZ day boundaries: a late-evening Kolkata event is today there while UTC is still yesterday", () => {
    const at = new Date("2026-11-14T19:30:00Z"); // 01:00 on the 15th in Kolkata
    const roomToday = roomDateKey({ roomTz: "Asia/Kolkata" }, at);
    expect(roomToday).toBe("2026-11-15");
    const days = agenda({ from: roomToday, today: roomToday, events: [ev("late", { date: "2026-11-15", time: "23:30" }), ev("gone", { date: "2026-11-14" })] });
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ date: "2026-11-15", isToday: true });
    expect(days[0]!.items.map((i) => i.id)).toEqual(["late"]);
    expect(dayHeading("2026-11-15", roomToday)).toBe("Today");
    expect(dayHeading("2026-11-16", roomToday)).toBe("Tomorrow");
  });
});

describe("countdowns", () => {
  const pair = (over: Partial<Pick<PairDoc, "nextMeetup" | "tripsSummary" | "nextCountdown">>): Pick<PairDoc, "nextMeetup" | "tripsSummary" | "nextCountdown"> => ({ nextMeetup: null, tripsSummary: [], nextCountdown: null, ...over });

  it("picks the nearest of the meetup, the next trip and the countdown event", () => {
    const p = pair({
      nextMeetup: { date: "2026-12-20", label: "Christmas visit", place: "Pune" },
      tripsSummary: [{ id: "t", title: "Goa", place: "Goa", startDate: "2026-12-01", endDate: "2026-12-05" }],
      nextCountdown: { id: "e", title: "Exam", emoji: "📚", date: "2026-11-14", who: ME },
    });
    expect(nearestCountdown(p, TODAY)).toMatchObject({ source: "event", date: "2026-11-14", label: "Exam", emoji: "📚" });
    expect(nearestCountdown({ ...p, nextCountdown: null }, TODAY)).toMatchObject({ source: "trip", date: "2026-12-01" });
    expect(nearestCountdown({ ...p, nextCountdown: null, tripsSummary: [] }, TODAY)).toMatchObject({ source: "meetup", date: "2026-12-20" });
  });

  it("a running multi-day event still counts; a finished one, a past trip and a past event are skipped", () => {
    const p = pair({ nextCountdown: { id: "e", title: "Conference", date: "2026-11-08", endDate: "2026-11-11", who: "both" }, tripsSummary: [{ id: "t", title: "Old", place: "", startDate: "2026-10-01", endDate: "2026-10-03" }] });
    expect(nearestCountdown(p, TODAY)).toMatchObject({ source: "event", date: "2026-11-08", endDate: "2026-11-11" });
    expect(nearestCountdown(pair({ nextCountdown: { id: "e", title: "Gone", date: "2026-11-01", who: ME } }), TODAY)).toBeNull();
  });

  it("falls back to a past meetup so the hero can still say how long ago, as before", () => {
    expect(nearestCountdown(pair({ nextMeetup: { date: "2026-10-01", label: "Last visit", place: "" } }), TODAY)).toMatchObject({ source: "meetup", date: "2026-10-01" });
  });

  it("the mirrored summary is the nearest countdown event with a day left, or null", () => {
    const events = [ev("a", { date: "2026-12-01", countdown: true }), ev("b", { date: "2026-11-20", countdown: true, emoji: "✈️", endDate: "2026-11-22" }), ev("c", { date: "2026-11-11" }), ev("d", { date: "2026-11-01", endDate: "2026-11-09", countdown: true })];
    expect(countdownSummaryFrom(events, TODAY)).toEqual({ id: "b", title: "Event b", emoji: "✈️", date: "2026-11-20", endDate: "2026-11-22", who: "both" });
    expect(countdownSummaryFrom(events.filter((e) => e.id !== "b"), TODAY)).toMatchObject({ id: "a" });
    expect(countdownSummaryFrom([ev("c")], TODAY)).toBeNull();
    const running = ev("run", { date: "2026-11-08", endDate: "2026-11-12", countdown: true });
    expect(countdownSummaryFrom([running], TODAY)).toMatchObject({ id: "run" });
  });

  it("summaryChanged only reports a real difference, so an unrelated edit writes nothing to pair/main", () => {
    const s = { id: "a", title: "A", date: "2026-11-20", who: ME };
    expect(summaryChanged(undefined, null)).toBe(false);
    expect(summaryChanged(null, s)).toBe(true);
    expect(summaryChanged(s, { ...s })).toBe(false);
    expect(summaryChanged(s, { ...s, title: "B" })).toBe(true);
    expect(summaryChanged(s, { ...s, emoji: "📚" })).toBe(true);
    expect(summaryChanged(s, null)).toBe(true);
  });
});

describe("wording and forms", () => {
  it("eventLine is the push body, chip and inbox row text", () => {
    expect(eventLine({ title: "Exam", date: "2026-11-14" })).toBe("Exam · 14 Nov");
    expect(eventLine({ title: "Trip", date: "2026-11-14", endDate: "2026-11-16" })).toBe("Trip · 14 Nov – 16 Nov");
    expect(eventLine({ title: "Odd", date: "nope" })).toBe("Odd");
  });
  it("Mark busy builds an all-day Busy event for me over the (ordered) range", () => {
    expect(busyEvent(ME, "2026-11-12", "2026-11-10")).toEqual({ title: "Busy", emoji: "⛔", date: "2026-11-10", endDate: "2026-11-12", who: ME, note: "", countdown: false });
    expect(busyEvent(ME, "2026-11-10", "2026-11-10")).not.toHaveProperty("endDate");
  });
  it("cleanEvent trims, bounds and drops empty optionals", () => {
    const out = cleanEvent({ title: `  ${"x".repeat(70)}  `, emoji: " ", date: "2026-11-14", endDate: "2026-11-14", time: "9am", who: "", note: " hi ".repeat(100), countdown: true });
    expect(out.title).toHaveLength(60);
    expect(out).not.toHaveProperty("emoji");
    expect(out).not.toHaveProperty("endDate");
    expect(out).not.toHaveProperty("time");
    expect(out.who).toBe("both");
    expect(out.note.length).toBeLessThanOrEqual(200);
    expect(cleanEvent({ title: "a", date: "2026-11-14", endDate: "2026-11-15", time: "09:30", who: FRIEND, note: "", countdown: false })).toMatchObject({ endDate: "2026-11-15", time: "09:30", who: FRIEND });
  });
});
