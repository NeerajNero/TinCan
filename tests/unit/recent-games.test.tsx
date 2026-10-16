// @vitest-environment happy-dom
/**
 * Recent games must render any row gameResults can hold: every catalogue
 * type, cancelled/abandoned/draw outcomes, and a type this build has never
 * heard of (the crash was GAME_META[r.game] being undefined for trivia).
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { RecentGamesList, type RecentResultRow } from "@/components/play/RecentGamesList";
import { GAME_CATALOG, gameInfo, resultLine, UNKNOWN_GAME } from "@/lib/games/catalog";

declare global {
   
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const at = (minutesAgo: number) => ({ toDate: () => new Date(Date.now() - minutesAgo * 60_000) });
const nameOf = (uid: string) => (uid === "a" ? "You" : "Sam");

describe("Recent games", () => {
  it("renders one row of every type, plus an unknown type, without throwing", () => {
    const rows: RecentResultRow[] = [
      ...Object.keys(GAME_CATALOG).map((game, i) => ({ id: `r${i}`, game, winnerId: i % 2 ? "a" : "b", endReason: "win", moves: 10 + i, endedAt: at(i) })),
      { id: "cancelled", game: "chess", winnerId: null, endReason: "cancelled", moves: 0, endedAt: at(30) },
      { id: "abandoned", game: "checkers", winnerId: null, endReason: "abandoned", moves: 4, endedAt: null },
      { id: "draw", game: "trivia", winnerId: null, endReason: "draw", moves: 10 },
      { id: "mystery", game: "laser-tag", winnerId: "b", endReason: "win" },
    ];
    const host = document.createElement("div");
    const root = createRoot(host);
    expect(() => act(() => root.render(<RecentGamesList rows={rows} nameOf={nameOf} />))).not.toThrow();

    const items = host.querySelectorAll("[data-game]");
    expect(items).toHaveLength(rows.length);
    expect(host.textContent).toContain("Trivia duel");
    expect(host.textContent).toContain("Pictionary");
    expect(host.textContent).toContain("Cancelled");
    expect(host.textContent).toContain("Abandoned");
    expect(host.querySelector('[data-game="unknown"]')?.textContent).toContain(UNKNOWN_GAME.name);
    act(() => root.unmount());
  });
});

describe("game catalogue", () => {
  it("never returns undefined", () => {
    for (const id of [undefined, null, "", "laser-tag", "__proto__", "toString"]) expect(gameInfo(id)).toBe(UNKNOWN_GAME);
    expect(gameInfo("trivia").emoji).toBe("🧠");
  });
  it("words result lines per game", () => {
    expect(resultLine("pictionary", "Sam")).toBe("🎨 Sam won the Pictionary game");
    expect(resultLine("trivia", null)).toBe("🧠 The trivia duel was a tie");
  });
});
