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
