import { beforeEach, describe, expect, it } from "vitest";

import { dockCollapsed, forgetDocks, nextDockState, rememberDock } from "@/lib/dock";

describe("collapsible dock state", () => {
  beforeEach(forgetDocks);

  it("starts expanded during a round and collapsed after it", () => {
    expect(nextDockState(undefined, true)).toEqual({ collapsed: false, roundActive: true });
    expect(nextDockState(undefined, false)).toEqual({ collapsed: true, roundActive: false });
  });

  it("collapses when the round ends and expands when one starts, whatever the person chose", () => {
    expect(nextDockState({ collapsed: false, roundActive: true }, false).collapsed).toBe(true);
    expect(nextDockState({ collapsed: true, roundActive: false }, true).collapsed).toBe(false);
    expect(nextDockState({ collapsed: true, roundActive: true }, false).collapsed).toBe(true);
    expect(nextDockState({ collapsed: false, roundActive: false }, true).collapsed).toBe(false);
  });

  it("keeps the person's choice while the round state is unchanged", () => {
    expect(nextDockState({ collapsed: true, roundActive: true }, true).collapsed).toBe(true);
    expect(nextDockState({ collapsed: false, roundActive: false }, false).collapsed).toBe(false);
  });

  it("remembers per screen for the session: hide, leave, come back → still hidden; a new round shows it again", () => {
    expect(dockCollapsed("word", true)).toBe(false);
    rememberDock("word", true);
    expect(dockCollapsed("word", true)).toBe(true);
    expect(dockCollapsed("hangman", true)).toBe(false);
    expect(dockCollapsed("word", false)).toBe(true);
    rememberDock("word", false);
    expect(dockCollapsed("word", false)).toBe(false);
    expect(dockCollapsed("word", true)).toBe(false);
  });

  it("a choice made before any round state is seen counts as made during a round", () => {
    rememberDock("word", true);
    expect(dockCollapsed("word", true)).toBe(true);
    expect(dockCollapsed("word", false)).toBe(true);
  });
});
