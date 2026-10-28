import { describe, expect, it } from "vitest";

import { createTabTimer, formatTabSwitch, tabSwitchLine } from "@/lib/tabTiming";

function setup() {
  let t = 1000;
  const timer = createTabTimer(() => t, () => 1_700_000_000_000 + t);
  return { timer, advance: (ms: number) => (t += ms) };
}

describe("tab switch timing", () => {
  it("measures tap → paint and flags the first visit as cold", () => {
    const { timer, advance } = setup();
    timer.tap("/chat", "/");
    advance(420);
    expect(timer.painted("/chat")).toMatchObject({ href: "/chat", ms: 420, cold: true });
    timer.tap("/", "/chat");
    advance(30);
    expect(timer.painted("/")).toMatchObject({ href: "/", ms: 30, cold: true }); // Home never "painted" through this path before
    timer.tap("/chat", "/");
    advance(85);
    expect(timer.painted("/chat")).toMatchObject({ ms: 85, cold: false });
    expect(timer.last()?.ms).toBe(85);
  });

  it("ignores a paint with no matching tap, and a tap on the current tab", () => {
    const { timer, advance } = setup();
    expect(timer.painted("/play")).toBeNull(); // app open, no tap
    timer.tap("/play", "/play");
    advance(10);
    expect(timer.painted("/play")).toBeNull();
    timer.tap("/plan", "/play");
    advance(10);
    expect(timer.painted("/play/trivia/x")).toBeNull(); // some other navigation painted first
    expect(timer.list()).toEqual([]);
  });

  it("a tap that painted only after a sub-route counts once the tab itself paints", () => {
    const { timer, advance } = setup();
    timer.tap("/play", "/play/trivia/x");
    advance(60);
    expect(timer.painted("/play")).toMatchObject({ ms: 60 });
  });

  it("drops a stale tap and keeps the last ten", () => {
    const { timer, advance } = setup();
    timer.tap("/more", "/");
    advance(31_000);
    expect(timer.painted("/more")).toBeNull();
    for (let i = 0; i < 12; i++) {
      timer.tap(i % 2 ? "/chat" : "/play", "/");
      advance(100 + i);
      timer.painted(i % 2 ? "/chat" : "/play");
    }
    expect(timer.list().length).toBe(10);
    expect(timer.list()[0]?.ms).toBe(102);
    expect(timer.last()?.ms).toBe(111);
  });

  it("formats the diagnostics row and dump line", () => {
    const { timer, advance } = setup();
    timer.tap("/chat", "/");
    advance(420);
    const s = timer.painted("/chat")!;
    expect(formatTabSwitch(s)).toBe("420 ms (cold: yes)");
    expect(tabSwitchLine(s)).toMatch(/^\/chat 420 ms cold \d{4}-\d{2}-\d{2}T/);
  });
});
