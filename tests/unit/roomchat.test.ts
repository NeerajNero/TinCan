import { describe, expect, it } from "vitest";

import { cleanRoomText, latestAt, ROOM_CHAT_KEEP, trimPatch, type RoomMessage } from "@/lib/roomChat";

const key = (n: number) => `-N${String(n).padStart(6, "0")}`;

describe("room chat", () => {
  it("trims the oldest keys beyond 50, whatever order they arrive in", () => {
    const keys = Array.from({ length: 53 }, (_, i) => key(i)).reverse();
    expect(trimPatch(keys)).toEqual({ [key(0)]: null, [key(1)]: null, [key(2)]: null });
  });

  it("does nothing at or under 50", () => {
    expect(trimPatch(Array.from({ length: ROOM_CHAT_KEEP }, (_, i) => key(i)))).toBeNull();
    expect(trimPatch([])).toBeNull();
  });

  it("accepts 1–500 chars after trimming", () => {
    expect(cleanRoomText("  hi 👋  ")).toBe("hi 👋");
    expect(cleanRoomText("   ")).toBeNull();
    expect(cleanRoomText("x".repeat(500))).toHaveLength(500);
    expect(cleanRoomText("x".repeat(501))).toBeNull();
  });

  it("finds the friend's newest message for the unread dot", () => {
    const msgs: RoomMessage[] = [
      { id: "1", uid: "me", text: "a", at: 300 },
      { id: "2", uid: "friend", text: "b", at: 200 },
    ];
    expect(latestAt(msgs)).toBe(300);
    expect(latestAt(msgs, "me")).toBe(200);
    expect(latestAt([], "me")).toBe(0);
  });
});
