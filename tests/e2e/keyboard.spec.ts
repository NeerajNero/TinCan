/**
 * The shared letter keyboard (Hangman and the daily word) must fit narrow
 * phones: at 360 px and 320 px neither keyboard scrolls sideways and the page
 * has no horizontal overflow. Uses the test-only /e2e/keyboard harness.
 */
import { expect, test } from "@playwright/test";

import { collectErrors } from "./violations";

for (const width of [360, 320]) {
  test(`keyboards fit a ${width} px viewport without horizontal scroll`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    const errors = collectErrors(page);
    await page.goto("/e2e/keyboard");
    await page.waitForLoadState("networkidle");
    for (const name of ["Letters", "Keyboard"]) {
      const kb = page.getByRole("group", { name, exact: true });
      await expect(kb).toBeVisible();
      const m = await kb.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth, keys: Array.from(el.querySelectorAll("button")).map((b) => b.getBoundingClientRect()) }));
      expect(m.scroll, `${name} scrollWidth vs clientWidth`).toBe(m.client);
      expect(m.client).toBeGreaterThan(0);
      for (const r of m.keys) {
        expect(r.left, `${name}: a key starts inside the viewport`).toBeGreaterThanOrEqual(0);
        expect(r.right, `${name}: a key ends inside the viewport`).toBeLessThanOrEqual(width + 0.5);
        expect(r.width, `${name}: every key has width`).toBeGreaterThan(0);
      }
    }
    const doc = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(doc.scroll, "the page has no horizontal overflow").toBeLessThanOrEqual(doc.client);
    // A used Hangman key is disabled; a fresh one still takes a tap.
    await expect(page.getByRole("button", { name: "Guess E" })).toBeDisabled();
    await page.getByRole("button", { name: "Guess Q" }).click();
    await expect(page.getByRole("button", { name: "Guess Q" })).toBeDisabled();
    expect(errors).toEqual([]);
  });
}
