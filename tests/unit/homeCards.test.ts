import { describe, expect, it } from "vitest";

import { DEFAULT_HOME_ORDER, HOME_CARDS, homeCardOrder, isDefaultHomeLayout, isHomeCardId, moveHomeCard, normalizeHomeCards, setHomeCardHidden } from "@/lib/homeCards";

const none = { snap: false, games: false };

describe("home layout: order, hidden cards and pins", () => {
  it("the default is every card in catalogue order, nothing hidden", () => {
    expect(homeCardOrder(undefined, none)).toEqual([...DEFAULT_HOME_ORDER]);
    expect(homeCardOrder(null, none)).toEqual(HOME_CARDS.map((c) => c.id));
    expect(isDefaultHomeLayout(undefined)).toBe(true);
    expect(isDefaultHomeLayout({ order: [...DEFAULT_HOME_ORDER], hidden: [] })).toBe(true);
  });

  it("keeps a saved order and appends cards the preference doesn't know, in default order", () => {
    const pref = { order: ["pet", "presence", "mood"], hidden: [] };
    const order = homeCardOrder(pref, none);
    expect(order.slice(0, 3)).toEqual(["pet", "presence", "mood"]);
    expect(order).toHaveLength(DEFAULT_HOME_ORDER.length);
    expect(order.slice(3)).toEqual(DEFAULT_HOME_ORDER.filter((id) => !["pet", "presence", "mood"].includes(id)));
    expect(isDefaultHomeLayout(pref)).toBe(false);
  });

  it("drops unknown and duplicate ids from a stored preference", () => {
    const { order, hidden } = normalizeHomeCards({ order: ["pet", "pet", "weather", "snap"], hidden: ["weather", "lamp", "lamp"] });
    expect(order.slice(0, 2)).toEqual(["pet", "snap"]);
    expect(new Set(order).size).toBe(order.length);
    expect(hidden).toEqual(["lamp"]);
    expect(isHomeCardId("weather")).toBe(false);
    expect(isHomeCardId("lamp")).toBe(true);
  });

  it("hidden cards are left out; pins put snap first, then games, and a pinned card shows even when hidden", () => {
    const pref = { order: [...DEFAULT_HOME_ORDER], hidden: ["snap", "games", "lamp"] };
    expect(homeCardOrder(pref, none)).not.toContain("snap");
    expect(homeCardOrder(pref, none)).not.toContain("lamp");
    const pinned = homeCardOrder(pref, { snap: true, games: true });
    expect(pinned.slice(0, 2)).toEqual(["snap", "games"]);
    expect(pinned).not.toContain("lamp");
    expect(pinned.filter((id) => id === "snap")).toHaveLength(1);
    expect(homeCardOrder(pref, { snap: false, games: true })[0]).toBe("games");
  });

  it("a pinned card that is also placed later in the order appears only once, at the top", () => {
    const order = homeCardOrder({ order: ["presence", "mood", "snap"], hidden: [] }, { snap: true, games: false });
    expect(order[0]).toBe("snap");
    expect(order.filter((id) => id === "snap")).toHaveLength(1);
    expect(order.slice(1, 3)).toEqual(["presence", "mood"]);
  });

  it("move and hide helpers edit the preference without losing cards", () => {
    const moved = moveHomeCard(undefined, "pet", 0);
    expect(moved.order[0]).toBe("pet");
    expect(moved.order).toHaveLength(DEFAULT_HOME_ORDER.length);
    expect(moveHomeCard(moved, "pet", 999).order.at(-1)).toBe("pet");
    const hidden = setHomeCardHidden(moved, "lamp", true);
    expect(hidden.hidden).toEqual(["lamp"]);
    expect(setHomeCardHidden(hidden, "lamp", false).hidden).toEqual([]);
    expect(setHomeCardHidden(hidden, "lamp", true).hidden).toEqual(["lamp"]);
  });
});
