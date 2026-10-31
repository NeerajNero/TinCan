/**
 * Every game board must fit narrow phones: at 320, 360 and 411 px no two
 * cells' bounding boxes intersect, no board overflows sideways and the square
 * ones are square. Uses the test-only /e2e/boards harness.
 */
import { expect, test } from "@playwright/test";

import { collectErrors } from "./violations";

const BOARDS = ["tictactoe", "connectfour", "checkers", "chess", "dots", "battleship", "pixel", "canvas"];

interface Measure {
  scroll: number;
  client: number;
  cells: number;
  overlap: string | null;
  grids: { name: string; w: number; h: number }[];
  outside: string | null;
}

for (const width of [320, 360, 411]) {
  test(`boards at ${width} px: no overlapping cells, no sideways overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const errors = collectErrors(page);
    await page.goto("/e2e/boards");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400); // let the spring animations settle
    for (const name of BOARDS) {
      const m: Measure = await page.locator(`[data-board="${name}"]`).evaluate((el, vw) => {
        const cells = Array.from(el.querySelectorAll<HTMLElement>("[data-cell]")).map((c) => c.getBoundingClientRect());
        let overlap: string | null = null;
        outer: for (let i = 0; i < cells.length; i++) {
          const a = cells[i]!;
          for (let j = i + 1; j < cells.length; j++) {
            const b = cells[j]!;
            if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) {
              overlap = `cells ${i} and ${j}: ${JSON.stringify([a.left, a.top, a.right, a.bottom])} vs ${JSON.stringify([b.left, b.top, b.right, b.bottom])}`;
              break outer;
            }
          }
        }
        let outside: string | null = null;
        for (const [i, c] of cells.entries()) if (c.left < -0.5 || c.right > vw + 0.5) { outside = `cell ${i} spans ${c.left}–${c.right}`; break; }
        const grids = Array.from(el.querySelectorAll<HTMLElement>("[data-grid]")).map((g) => ({ name: g.dataset.grid ?? "", w: g.getBoundingClientRect().width, h: g.getBoundingClientRect().height }));
        return { scroll: el.scrollWidth, client: el.clientWidth, cells: cells.length, overlap, grids, outside };
      }, width);
      expect.soft(m.cells, `${name} has cells`).toBeGreaterThan(0);
      expect.soft(m.overlap, `${name} @ ${width}px: cells intersect`).toBeNull();
      expect.soft(m.outside, `${name} @ ${width}px: a cell leaves the viewport`).toBeNull();
      expect.soft(m.scroll, `${name} @ ${width}px: scrollWidth vs clientWidth`).toBe(m.client);
      for (const g of m.grids) {
        expect.soft(g.w, `${g.name} @ ${width}px has width`).toBeGreaterThan(0);
        expect.soft(Math.abs(g.w - g.h), `${g.name} @ ${width}px is square (${g.w}×${g.h})`).toBeLessThanOrEqual(1.5);
      }
    }
    const doc = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(doc.scroll, "the page has no horizontal overflow").toBeLessThanOrEqual(doc.client);
    expect(errors).toEqual([]);
  });
}

/**
 * The GameScreen composite (phase 26) with the daily word and Hangman: at
 * phone widths and heights the dock's bottom edge stays inside the viewport
 * (above the tab-bar row), the page and <main> do not scroll (only the content
 * area may), the board fits the content area, and the keyboard never scrolls
 * sideways.
 */
for (const screen of ["word", "hangman"]) {
  for (const width of [320, 360, 411]) {
    for (const height of [740, 826]) {
      test(`${screen} on GameScreen at ${width}×${height}: dock in view, no page scroll, keyboard fits`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        const errors = collectErrors(page);
        await page.goto(`/e2e/game-screen?screen=${screen}`);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(300);
        const m = await page.evaluate(() => {
          const dock = document.querySelector<HTMLElement>("[data-game-dock]")!;
          const main = document.querySelector<HTMLElement>("[data-main]")!;
          const content = document.querySelector<HTMLElement>("[data-game-content]")!;
          const tabbar = document.querySelector<HTMLElement>("[data-tabbar]")!;
          const kb = document.querySelector<HTMLElement>("[role=group][aria-label]")!;
          const grid = document.querySelector<HTMLElement>("[data-grid]");
          const r = (el: HTMLElement) => el.getBoundingClientRect();
          return {
            dockBottom: r(dock).bottom,
            dockHeight: r(dock).height,
            tabbarTop: r(tabbar).top,
            viewport: window.innerHeight,
            docScroll: document.documentElement.scrollHeight,
            docClient: document.documentElement.clientHeight,
            mainScroll: main.scrollHeight,
            mainClient: main.clientHeight,
            contentScroll: content.scrollHeight,
            contentClient: content.clientHeight,
            kbScroll: kb.scrollWidth,
            kbClient: kb.clientWidth,
            gridW: grid ? r(grid).width : 0,
            gridH: grid ? r(grid).height : 0,
          };
        });
        expect.soft(m.dockHeight, "the dock has content").toBeGreaterThan(40);
        expect.soft(m.dockBottom, "dock bottom inside the viewport").toBeLessThanOrEqual(m.viewport + 0.5);
        expect.soft(m.dockBottom, "dock sits above the tab bar").toBeLessThanOrEqual(m.tabbarTop + 0.5);
        expect.soft(m.docScroll, "the page has no vertical scroll").toBeLessThanOrEqual(m.docClient);
        expect.soft(m.mainScroll, "<main> does not scroll (only the content area may)").toBeLessThanOrEqual(m.mainClient + 1);
        expect.soft(m.contentScroll, "the board fits the content area without scrolling").toBeLessThanOrEqual(m.contentClient + 1);
        expect.soft(m.kbScroll, "keyboard scrollWidth vs clientWidth").toBe(m.kbClient);
        if (screen === "word") expect.soft(Math.abs(m.gridW / m.gridH - 5 / 6), "word grid keeps 5:6").toBeLessThan(0.05);
        const doc = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
        expect.soft(doc.scroll, "no horizontal overflow").toBeLessThanOrEqual(doc.client);
        expect(errors).toEqual([]);
      });
    }
  }
}
