import { describe, expect, it } from "vitest";

import { HOWTO } from "@/content/howto";
import { entriesIn, gameIdForPath, pickSurprise, PLAY_ENTRIES, playIdForPath, playInfo } from "@/lib/play/catalog";
import { favouritesOf, PLAY_FAVOURITES_MAX, PLAY_RECENT_MAX, PLAY_RECENT_THROTTLE_MS, recentOf, recordRecent, sectionOpen, toggleFavourite, type PlayUsage } from "@/lib/play/usage";

const t0 = 1_700_000_000_000;
const row = (id: string, at: number, by = "a") => ({ id, at, by });

describe("recent", () => {
  it("prepends a first open and keeps newest first", () => {
    expect(recordRecent(undefined, "chess", "a", t0)).toEqual([row("chess", t0)]);
    expect(recordRecent({ recent: [row("chess", t0)] }, "watch", "b", t0 + 1)).toEqual([row("watch", t0 + 1, "b"), row("chess", t0)]);
  });
  it("de-duplicates: an old entry moves to the front", () => {
    const usage: PlayUsage = { recent: [row("watch", t0 + 1), row("chess", t0)] };
    expect(recordRecent(usage, "chess", "b", t0 + PLAY_RECENT_THROTTLE_MS)).toEqual([row("chess", t0 + PLAY_RECENT_THROTTLE_MS, "b"), row("watch", t0 + 1)]);
  });
  it("throttles: the same game inside ten minutes writes nothing, whoever opened it", () => {
    const usage: PlayUsage = { recent: [row("watch", t0 + 1), row("chess", t0)] };
    expect(recordRecent(usage, "chess", "b", t0 + PLAY_RECENT_THROTTLE_MS - 1)).toBeNull();
    expect(recordRecent(usage, "chess", "a", t0 + 5)).toBeNull();
    expect(recordRecent(usage, "chess", "a", t0 + PLAY_RECENT_THROTTLE_MS)).not.toBeNull();
  });
  it("caps at eight", () => {
    const usage: PlayUsage = { recent: Array.from({ length: PLAY_RECENT_MAX }, (_, i) => row(`g${i}`, t0 - i)) };
    const next = recordRecent(usage, "new", "a", t0 + 1);
    expect(next).toHaveLength(PLAY_RECENT_MAX);
    expect(next?.[0]?.id).toBe("new");
    expect(next?.some((r) => r.id === `g${PLAY_RECENT_MAX - 1}`)).toBe(false);
  });
  it("ignores malformed or duplicated stored rows", () => {
    const usage = { recent: [row("chess", t0), "junk", { id: 3, at: 1 }, row("chess", t0 - 5), null] } as unknown as PlayUsage;
    expect(recentOf(usage)).toEqual([row("chess", t0)]);
    expect(recentOf(undefined)).toEqual([]);
  });
});

describe("favourites", () => {
  it("pins, is idempotent and unpins", () => {
    expect(toggleFavourite(undefined, "chess", true)).toEqual(["chess"]);
    expect(toggleFavourite({ favourites: ["chess"] }, "chess", true)).toEqual(["chess"]);
    expect(toggleFavourite({ favourites: ["chess", "watch"] }, "chess", false)).toEqual(["watch"]);
    expect(toggleFavourite({ favourites: ["watch"] }, "chess", false)).toEqual(["watch"]);
  });
  it("refuses a seventh pin but still unpins when full", () => {
    const full = { favourites: Array.from({ length: PLAY_FAVOURITES_MAX }, (_, i) => `f${i}`) };
    expect(toggleFavourite(full, "chess", true)).toBeNull();
    expect(toggleFavourite(full, "f0", false)).toHaveLength(PLAY_FAVOURITES_MAX - 1);
  });
  it("drops non-strings and repeats from storage", () => {
    expect(favouritesOf({ favourites: ["a", 1, "a", null] as unknown as string[] })).toEqual(["a"]);
  });
});

describe("sections", () => {
  it("remembered choice wins, else collapsed once Recent has entries", () => {
    expect(sectionOpen("1", true)).toBe(true);
    expect(sectionOpen("0", false)).toBe(false);
    expect(sectionOpen(null, false)).toBe(true);
    expect(sectionOpen(null, true)).toBe(false);
  });
});

describe("play catalogue", () => {
  it("lists every board game, quick-play screen and together activity once, each with a how-to", () => {
    const ids = PLAY_ENTRIES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(7 + 8 + 8);
    expect(entriesIn("board")).toHaveLength(7);
    expect(entriesIn("quick")).toHaveLength(8);
    expect(entriesIn("together")).toHaveLength(8);
    for (const e of PLAY_ENTRIES) {
      expect(HOWTO[e.id].title.length).toBeGreaterThan(0);
      expect(e.short.length).toBeLessThanOrEqual(11);
    }
  });
  it("looks ids up safely", () => {
    expect(playInfo("hangman")?.section).toBe("board");
    expect(playInfo("wyr")?.href).toBe("/play/deck/wyr");
    expect(playInfo("hangout")).toBeUndefined();
    expect(playInfo(null)).toBeUndefined();
  });
  it("maps routes to entries", () => {
    expect(playIdForPath("/play/word")).toBe("word");
    expect(playIdForPath("/play/trivia/abc")).toBe("trivia");
    expect(playIdForPath("/play/quiz/xyz?join=1")).toBe("quiz");
    expect(playIdForPath("/play/deck/nhie")).toBe("nhie");
    expect(playIdForPath("/play/deck/unknown")).toBeNull();
    expect(playIdForPath("/play/cook/r1")).toBe("cook");
    expect(playIdForPath("/play")).toBeNull();
    expect(playIdForPath("/play/-Nabc123")).toBeNull();
    expect(playIdForPath("/chat")).toBeNull();
    expect(playIdForPath("/playground/word")).toBeNull();
  });
  it("tells a board-game route apart from the rest", () => {
    expect(gameIdForPath("/play/-Nabc123")).toBe("-Nabc123");
    expect(gameIdForPath("/play/word")).toBeNull();
    expect(gameIdForPath("/play/trivia/abc")).toBeNull();
    expect(gameIdForPath("/play")).toBeNull();
    expect(gameIdForPath("/memories")).toBeNull();
  });
  it("surprises from the whole list", () => {
    expect(pickSurprise(PLAY_ENTRIES, () => 0).id).toBe(PLAY_ENTRIES[0]?.id);
    expect(pickSurprise(PLAY_ENTRIES, () => 0.999999).id).toBe(PLAY_ENTRIES[PLAY_ENTRIES.length - 1]?.id);
    expect(pickSurprise(PLAY_ENTRIES, () => 1).id).toBe(PLAY_ENTRIES[PLAY_ENTRIES.length - 1]?.id);
  });
});
