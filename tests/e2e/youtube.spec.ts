/**
 * Watch/listen together's YouTube player, in a real browser with the real CSP
 * and Permissions-Policy, via the test-only /e2e/youtube harness (served only
 * with E2E_HARNESS=1). Needs network access to YouTube.
 * M7lc1UVf-VE is YouTube's own IFrame API sample video (embeddable).
 * Actual playback is skipped on CI: YouTube refuses to play from GitHub's
 * datacenter addresses (the player stays unstarted), so only loading, cueing,
 * the embed URL and the player's size are checked there.
 */
import { expect, test, type Page } from "@playwright/test";

import { collectErrors } from "./violations";

const VIDEO = "M7lc1UVf-VE";
// Firebase Auth adds its own hidden iframe; pick the player.
const PLAYER = 'iframe[src^="https://www.youtube-nocookie.com/embed/"]';
const PLAYING = 1;
const BUFFERING = 3;
const PAUSED = 2;

// window.__yt / window.__ytPlayer are declared by the harness (src/components/dev/YouTubeHarness.tsx).

async function open(page: Page, query: string) {
  // YouTube's own iframe logs noise (unrecognised features, postMessage before load); only policy and id errors count.
  const errors = collectErrors(page, (text) => /Content Security Policy|Permissions policy violation|Invalid video id/i.test(text));
  await page.goto(`/e2e/youtube?v=${VIDEO}&${query}`);
  await page.waitForFunction(() => window.__yt?.ready === true, null, { timeout: 30_000 });
  return errors;
}

for (const late of [0, 1500]) {
  test(`onReady fires and the video is cued (id arrives after ${late} ms)`, async ({ page }) => {
    const errors = await open(page, `late=${late}`);
    expect(await page.evaluate(() => window.__ytPlayer?.getVideoData?.()?.video_id)).toBe(VIDEO);
    const src = await page.locator(PLAYER).getAttribute("src");
    expect(src).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\//);
    expect(src).toContain(`origin=${encodeURIComponent("http://127.0.0.1:3100")}`);
    expect(errors).toEqual([]);
  });
}

const NO_PLAYBACK_ON_CI = Boolean(process.env.CI);

test("play, seek and pause from a tap work", async ({ page }) => {
  test.skip(NO_PLAYBACK_ON_CI, "YouTube refuses playback from GitHub's datacenter IPs");
  const errors = await open(page, "late=800");
  await page.getByRole("button", { name: "Play" }).click();
  await expect.poll(() => page.evaluate(() => window.__ytPlayer?.getPlayerState()), { timeout: 20_000 }).toBe(PLAYING);
  await page.getByRole("button", { name: "Seek 30" }).click();
  await expect.poll(() => page.evaluate(() => window.__ytPlayer?.getCurrentTime() ?? 0), { timeout: 20_000 }).toBeGreaterThanOrEqual(29);
  await page.getByRole("button", { name: "Pause" }).click();
  await expect.poll(() => page.evaluate(() => window.__ytPlayer?.getPlayerState()), { timeout: 10_000 }).toBe(PAUSED);
  const states = await page.evaluate(() => window.__yt?.states ?? []);
  expect(states.some((s) => s === PLAYING || s === BUFFERING)).toBe(true);
  expect(errors).toEqual([]);
});

test("listen's player is a real size under the cover", async ({ page }) => {
  await open(page, "late=300&variant=audio");
  const box = await page.locator(PLAYER).boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(200);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(200);
  const cover = await page.getByTestId("cover").boundingBox();
  expect(cover).toEqual(box);
  expect(await page.locator(PLAYER).evaluate((el) => getComputedStyle(el).display)).not.toBe("none");
});

test("listen's player still plays under the cover", async ({ page }) => {
  test.skip(NO_PLAYBACK_ON_CI, "YouTube refuses playback from GitHub's datacenter IPs");
  await open(page, "late=300&variant=audio");
  await page.getByRole("button", { name: "Play" }).click();
  await expect.poll(() => page.evaluate(() => window.__ytPlayer?.getPlayerState()), { timeout: 20_000 }).toBe(PLAYING);
});
