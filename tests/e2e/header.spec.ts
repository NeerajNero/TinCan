/**
 * The persistent app header (chore: persistent app header) is mounted once and
 * never moves: its bounding box, and the boxes of the ? button and the bell,
 * are identical before and after switching tabs (which swaps the declared
 * title, emoji, subtitle, back arrow and actions) and after the unread badge
 * appears, grows to "99+" and clears.
 */
import { expect, test, type Page } from "@playwright/test";

async function boxes(page: Page) {
  const header = await page.locator("[data-app-header]").boundingBox();
  const bell = await page.locator("[data-header-bell]").boundingBox();
  const slot = await page.locator("[data-header-bell-slot]").boundingBox();
  expect(header).not.toBeNull();
  expect(bell).not.toBeNull();
  expect(slot).not.toBeNull();
  return { header: header!, bell: bell!, slot: slot! };
}

test("the header's box is identical across a tab switch and badge changes", async ({ page }) => {
  await page.goto("/e2e/header");
  await expect(page.locator("[data-app-header] h1")).toHaveText("Hi, Sam");
  // Tab A declares `help`, whose how-to sheet auto-opens on a first visit; its scrim would swallow the taps below.
  await page.getByRole("button", { name: "Got it" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const before = await boxes(page);
  expect(before.header.height).toBeGreaterThanOrEqual(56);
  expect(before.bell.width).toBe(44);

  await page.locator("[data-tab=b]").click();
  await expect(page.locator("[data-content=b]")).toBeVisible();
  await expect(page.locator("[data-app-header]")).toContainText("Priya is here");
  await expect(page.locator('[data-app-header] [aria-label="Back"]')).toBeVisible();
  expect(await boxes(page)).toEqual(before);

  await page.locator("[data-badge-bump]").click();
  await expect(page.locator('[data-testid="inbox-badge"]')).toHaveText("1");
  expect(await boxes(page)).toEqual(before);

  await page.locator("[data-badge-many]").click();
  await expect(page.locator('[data-testid="inbox-badge"]')).toHaveText("99+");
  expect(await boxes(page)).toEqual(before);

  await page.locator("[data-header-bell]").click();
  await expect(page.locator('[data-testid="inbox-badge"]')).toHaveCount(0);
  expect(await boxes(page)).toEqual(before);

  await page.locator("[data-tab=a]").click();
  await expect(page.locator("[data-app-header] h1")).toHaveText("Hi, Sam");
  expect(await boxes(page)).toEqual(before);

  // The long title truncates inside the bar instead of growing it.
  await page.locator("[data-tab=b]").click();
  const title = page.locator("[data-app-header] h1");
  await expect(title).toContainText("A much longer title");
  const overflow = await title.evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(overflow).toBe(true);
  expect(await boxes(page)).toEqual(before);
});

test("the document stays one viewport tall with the header in the shell", async ({ page }) => {
  await page.goto("/e2e/header");
  const m = await page.evaluate(() => ({ viewport: window.innerHeight, doc: document.documentElement.scrollHeight }));
  expect(m.doc).toBe(m.viewport);
});
