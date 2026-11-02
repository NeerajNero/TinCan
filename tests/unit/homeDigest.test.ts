import { describe, expect, it } from "vitest";

import { digestGreeting, digestItems, digestLines, type DigestInput } from "@/lib/digest";
import { homeDigestInput, type HomeDigestSource } from "@/lib/homeDigest";

const A = "uid-a";
const B = "uid-b";
const TODAY = "2026-11-02";
const NOON = Date.UTC(2026, 10, 2, 12, 0, 0);
const ts = (ms: number) => ({ toMillis: () => ms }) as unknown as { toMillis(): number; toDate(): Date };

const quiet: HomeDigestSource = {
  uid: A,
  friendUid: B,
  sinceMs: NOON - 3 * 3_600_000,
  now: NOON,
  today: TODAY,
  unread: 0,
  snapSummary: null,
  schedule: undefined,
  friendNote: null,
  daily: null,
  myTurn: 0,
  invites: 0,
  jar: undefined,
  milestonesToday: [],
  pet: undefined,
};

describe("home digest: the sentence from fixtures", () => {
  it("is empty when nothing happened", () => {
    expect(digestItems(homeDigestInput(quiet), "Shravya")).toEqual([]);
  });

  it("lists everything that happened since the last open, each with a deep link", () => {
    const src: HomeDigestSource = {
      ...quiet,
      unread: 3,
      snapSummary: { posted: { [B]: true } },
      schedule: { todayKey: TODAY, todayAt: NOON - 60_000 },
      friendNote: { text: "coffee run", emoji: "☕", at: ts(NOON - 30 * 60_000) as never, expiresAt: ts(NOON + 3_600_000) as never },
      daily: { answers: { [B]: { text: "pasta", at: ts(NOON - 10 * 60_000) as never } } },
      myTurn: 1,
      invites: 2,
      jar: { addedAt: NOON - 20 * 60_000, addedBy: B, drawnAt: NOON - 40 * 60_000, drawnBy: B },
      milestonesToday: ["Diwali"],
      pet: { name: "Blob", species: "blob", hungerAt: NOON - 23 * 3_600_000, happyAt: NOON, sleepAt: 0, level: 1, bornAt: 0 },
    };
    const items = digestItems(homeDigestInput(src), "Shravya");
    expect(items.map((i) => i.key)).toEqual(["turn", "invites", "unread", "snap-theirs", "note", "answered", "jar-added", "jar-drawn", "pet", "milestone:Diwali"]);
    expect(items.map((i) => `${i.emoji} ${i.text}`)).toEqual([
      "🎲 your turn in a game",
      "🎮 2 game invites waiting",
      "💬 3 unread messages",
      "📸 Shravya posted today's snap",
      "📝 Shravya left a note: ☕ coffee run",
      "✍️ Shravya answered today's question",
      "🫙 Shravya dropped a note in your jar",
      "🫙 Shravya drew one of your jar notes",
      "🐾 Blob needs food",
      "🎉 Diwali is today",
    ]);
    expect(new Set(items.map((i) => i.url))).toEqual(new Set(["/play", "/chat", "/snap", "/", "/memories/jar", "/pet", "/memories/milestones"]));
  });

  it("only counts what is newer than the last open; current-state items (turn, pet, milestone) always count", () => {
    const old = NOON - 5 * 3_600_000;
    const src: HomeDigestSource = {
      ...quiet,
      friendNote: { text: "old", at: ts(old) as never, expiresAt: ts(NOON + 1) as never },
      daily: { answers: { [B]: { text: "x", at: ts(old) as never } } },
      jar: { addedAt: old, addedBy: B, drawnAt: NOON - 60_000, drawnBy: A },
      snapSummary: { posted: { [B]: true } },
      schedule: { todayKey: TODAY, todayAt: old - 3_600_000 },
      myTurn: 2,
    };
    const items = digestItems(homeDigestInput(src), "Shravya");
    expect(items.map((i) => i.key)).toEqual(["turn"]); // the note, answer, jar add and the friend's earlier snap predate the last open; my own draw never counts
  });

  it("the first open ever (no lastOpenAt) treats everything present as new", () => {
    const src: HomeDigestSource = { ...quiet, sinceMs: null, unread: 1, friendNote: { text: "hi", at: ts(NOON - 1) as never, expiresAt: ts(NOON + 1) as never } };
    expect(digestItems(homeDigestInput(src), "Shravya").map((i) => i.key)).toEqual(["unread", "note"]);
  });

  it("an expired note never shows, and a snap the friend posted yesterday isn't today's", () => {
    const src: HomeDigestSource = {
      ...quiet,
      friendNote: { text: "gone", at: ts(NOON - 1) as never, expiresAt: ts(NOON - 1) as never },
      snapSummary: { posted: { [B]: true } },
      schedule: { todayKey: "2026-11-01", todayAt: NOON - 86_400_000 },
    };
    expect(digestItems(homeDigestInput(src), "Shravya")).toEqual([]);
  });

  it("the morning push uses the same items, so the two never drift", () => {
    const input: DigestInput = { ...homeDigestInput({ ...quiet, unread: 2, myTurn: 1 }), jarNotes: 1, snapWaiting: true };
    expect(digestLines(input)).toEqual(["🎲 your turn in a game", "💬 2 unread messages", "📸 today's snap is still waiting for yours", "🫙 1 jar note to draw"]);
  });

  it("greets by how long it has been", () => {
    expect(digestGreeting(null, NOON)).toBe("While you were away");
    expect(digestGreeting(NOON - 10 * 60_000, NOON)).toBe("In the last hour");
    expect(digestGreeting(NOON - 5 * 3_600_000, NOON)).toBe("Since you were last here");
    expect(digestGreeting(NOON - 24 * 3_600_000, NOON)).toBe("Since yesterday");
    expect(digestGreeting(NOON - 3 * 86_400_000, NOON)).toBe("Over the last 3 days");
  });
});
