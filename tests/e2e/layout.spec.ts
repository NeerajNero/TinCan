/**
 * The document must never scroll. globals.css clamps html/body (overflow:
 * hidden), but the clamp alone would just *clip* a screen that grew too tall,
 * leaving its bottom unreachable. So each check runs twice: as shipped, and
 * with the clamp lifted, where a screen in normal flow taller than the
 * viewport makes document.scrollHeight exceed it. Every screen must live in a
 * position: fixed box with its own scroller (the app shell, or `screen-fixed`).
 */
import { expect, test, type Page } from "@playwright/test";

async function documentHeight(page: Page, { liftClamp }: { liftClamp: boolean }) {
  return page.evaluate((lift) => {
    if (lift) {
      for (const el of [document.documentElement, document.body]) {
        el.style.overflow = "visible";
        el.style.height = "auto";
      }
    }
    return { viewport: window.innerHeight, doc: document.documentElement.scrollHeight };
  }, liftClamp);
}

async function expectLocked(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  for (const liftClamp of [false, true]) {
    const m = await documentHeight(page, { liftClamp });
    expect(m.doc, `${path} (${liftClamp ? "without" : "with"} the html/body clamp)`).toBe(m.viewport);
  }
}

for (const path of ["/signin", "/offline"]) {
  test(`${path}: the document is exactly one viewport tall`, async ({ page }) => {
    await expectLocked(page, path);
  });

  test(`${path}: still one viewport tall when the screen is shorter than its content`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 200 });
    await expectLocked(page, path);
    await page.evaluate(() => window.scrollTo(0, 400));
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
}
