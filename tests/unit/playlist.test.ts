import { describe, expect, it } from "vitest";

import { addItem, hasVideo, isFull, moveItem, PLAYLIST_MAX, removeItem, type PlaylistItem } from "@/lib/playlist";

const id = (n: number) => `vid${String(n).padStart(8, "0")}`; // 11 chars
const item = (n: number, title = `Song ${n}`): PlaylistItem => ({ videoId: id(n), title, addedBy: "a", addedAt: n });
const ids = (items: PlaylistItem[]) => items.map((i) => i.videoId);

describe("playlist helpers", () => {
  it("adds to the end and dedupes by videoId", () => {
    let list = addItem([], item(1));
    list = addItem(list, item(2));
    list = addItem(list, item(1, "same video, new title"));
    expect(ids(list)).toEqual([id(1), id(2)]);
    expect(list[0]?.title).toBe("Song 1");
  });

  it("inserts at an index (undo) and clamps it", () => {
    const list = [item(1), item(2)];
    expect(ids(addItem(list, item(3), 1))).toEqual([id(1), id(3), id(2)]);
    expect(ids(addItem(list, item(3), 99))).toEqual([id(1), id(2), id(3)]);
    expect(ids(addItem(list, item(3), -4))).toEqual([id(3), id(1), id(2)]);
  });

  it("rejects ids that aren't YouTube ids and caps titles at 200", () => {
    expect(addItem([], { ...item(1), videoId: "nope" })).toEqual([]);
    expect(addItem([], item(1, "x".repeat(500)))[0]?.title).toHaveLength(200);
    expect(addItem([], item(1, "   "))[0]?.title).toBe("YouTube video");
  });

  it("stops at 50", () => {
    let list: PlaylistItem[] = [];
    for (let n = 0; n < PLAYLIST_MAX; n++) list = addItem(list, item(n));
    expect(list).toHaveLength(50);
    expect(isFull(list)).toBe(true);
    expect(addItem(list, item(999))).toHaveLength(50);
    expect(hasVideo(addItem(list, item(999)), id(999))).toBe(false);
    expect(isFull(removeItem(list, id(3)))).toBe(false);
  });

  it("removes by videoId and leaves others alone", () => {
    const list = [item(1), item(2), item(3)];
    expect(ids(removeItem(list, id(2)))).toEqual([id(1), id(3)]);
    expect(removeItem(list, id(9))).toEqual(list);
  });

  it("moves forwards, backwards and clamps; a bad source is a no-op", () => {
    const list = [item(1), item(2), item(3), item(4)];
    expect(ids(moveItem(list, 0, 2))).toEqual([id(2), id(3), id(1), id(4)]);
    expect(ids(moveItem(list, 3, 0))).toEqual([id(4), id(1), id(2), id(3)]);
    expect(ids(moveItem(list, 1, 99))).toEqual([id(1), id(3), id(4), id(2)]);
    expect(ids(moveItem(list, -1, 0))).toEqual(ids(list));
    expect(ids(list)).toEqual([id(1), id(2), id(3), id(4)]); // never mutates
  });
});
