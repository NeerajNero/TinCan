import { describe, expect, it } from "vitest";

import { initialHealth, reduceHealth } from "@/lib/firestoreHealth";

describe("Firestore health counter", () => {
  it("does not count the initial cached snapshot as an outage", () => {
    const h = reduceHealth(initialHealth(), true, 1000);
    expect(h.online).toBe(false);
    expect(h.offlineCount).toBe(0);
    const online = reduceHealth(h, false, 2000);
    expect(online.online).toBe(true);
    expect(online.offlineMs).toBe(0);
    expect(online.lastOnlineAt).toBe(2000);
  });

  it("counts each server → cache transition once and sums finished outages", () => {
    let h = reduceHealth(initialHealth(), false, 0);
    h = reduceHealth(h, true, 10_000); // offline #1
    h = reduceHealth(h, true, 11_000); // still offline, no double count
    expect(h.offlineCount).toBe(1);
    expect(h.lastOfflineAt).toBe(10_000);
    h = reduceHealth(h, false, 40_000); // back
    expect(h.offlineMs).toBe(30_000);
    h = reduceHealth(h, true, 50_000); // offline #2, ongoing
    expect(h.offlineCount).toBe(2);
    expect(h.offlineMs).toBe(30_000);
    expect(h.online).toBe(false);
  });

  it("returns the same object when nothing changed", () => {
    const h = reduceHealth(initialHealth(), false, 0);
    expect(reduceHealth(h, false, 5)).toBe(h);
  });
});
