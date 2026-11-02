import { describe, expect, it } from "vitest";

import { isNoteReply, NOTE_MAX, NOTE_TTL_MS, noteAsMessage, noteExpired, noteLine, noteVisible } from "@/lib/notes";

const ts = (ms: number) => ({ toMillis: () => ms });
const NOW = 1_800_000_000_000;

describe("notes: expiry", () => {
  it("shows a note until expiresAt, then hides it; the tick sees the same boundary", () => {
    const note = { text: "coffee run", emoji: "☕", at: ts(NOW), expiresAt: ts(NOW + NOTE_TTL_MS) };
    expect(noteVisible(note, NOW)).toBe(true);
    expect(noteVisible(note, NOW + NOTE_TTL_MS - 1)).toBe(true);
    expect(noteVisible(note, NOW + NOTE_TTL_MS)).toBe(false);
    expect(noteExpired(note, NOW + NOTE_TTL_MS - 1)).toBe(false);
    expect(noteExpired(note, NOW + NOTE_TTL_MS)).toBe(true);
  });
  it("null, missing, empty and malformed notes are never shown; the tick leaves null alone", () => {
    expect(noteVisible(null, NOW)).toBe(false);
    expect(noteVisible(undefined, NOW)).toBe(false);
    expect(noteVisible({ text: "   ", expiresAt: ts(NOW + 1) }, NOW)).toBe(false);
    expect(noteVisible({ text: "x", expiresAt: null }, NOW)).toBe(false);
    expect(noteExpired(null, NOW)).toBe(false);
    expect(noteExpired({ text: "x", expiresAt: null }, NOW)).toBe(true); // unreadable expiry: clear it
  });
  it("the line puts the emoji first and caps the text", () => {
    expect(noteLine({ text: "  hi  ", emoji: "📝" })).toBe("📝 hi");
    expect(noteLine({ text: "hi" })).toBe("hi");
    expect(noteLine({ text: "x".repeat(80) }).length).toBe(NOTE_MAX);
  });
  it("a note becomes a reply quote with an id no message can have", () => {
    const m = noteAsMessage("uid-b", { text: "lunch?", emoji: "🍜", at: ts(NOW) });
    expect(m.senderId).toBe("uid-b");
    expect(m.text).toBe("🍜 lunch?");
    expect(m.createdAtMs).toBe(NOW);
    expect(isNoteReply(m.id)).toBe(true);
    expect(isNoteReply("abc123")).toBe(false);
  });
});
