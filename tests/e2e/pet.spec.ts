/**
 * Pet life in a real browser via the test-only /e2e/pet harness (served only
 * with E2E_HARNESS=1): sequence timing (writes land at the end, buttons are
 * disabled meanwhile), the particle cap, long-press petting, the friend's
 * actions replayed with a toast, the compact size without particles, and
 * reduced motion.
 */
import { expect, test, type Page } from "@playwright/test";

// window.__pet is declared by the harness (src/components/dev/PetHarness.tsx).

async function open(page: Page, query = "") {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(`/e2e/pet${query}`);
  await page.waitForFunction(() => Array.isArray(window.__pet?.writes));
  // Let LazyMotion's feature bundle load before driving animations.
  await page.waitForTimeout(500);
  return errors;
}

const pet = (page: Page) => page.getByRole("button", { name: /tap to play, hold to pet/ });
const writes = (page: Page) => page.evaluate(() => window.__pet?.writes ?? []);
const particles = (page: Page) => page.locator("[data-particle]").count();

test("feed: button disabled during the ~2 s sequence, write lands at the chomp", async ({ page }) => {
  const errors = await open(page);
  const feed = page.getByRole("button", { name: "Feed", exact: true });
  const t0 = await page.evaluate(() => performance.now());
  await feed.click();
  await expect(feed).toBeDisabled();
  await page.waitForFunction(() => window.__pet?.writes.some((w) => w.kind === "feed"));
  const w = (await writes(page)).find((x) => x.kind === "feed");
  expect(w!.at - t0).toBeGreaterThan(1000);
  expect(w!.at - t0).toBeLessThan(1900);
  await expect(feed).toBeEnabled({ timeout: 3000 });
  await expect(page.getByRole("progressbar", { name: "Food" })).toHaveAttribute("aria-valuenow", "100");
  expect(errors).toEqual([]);
});

test("sleep and wake write only at the end of their sequences", async ({ page }) => {
  await open(page);
  const t0 = await page.evaluate(() => performance.now());
  await page.getByRole("button", { name: "Tuck in" }).click();
  await page.waitForTimeout(800);
  expect((await writes(page)).length).toBe(0);
  await expect(page.getByTestId("mood")).not.toContainText("sleeping");
  await page.waitForFunction(() => window.__pet?.writes.some((w) => w.kind === "tuckIn"));
  const sleep = (await writes(page)).find((x) => x.kind === "tuckIn");
  expect(sleep!.at - t0).toBeGreaterThan(1300);
  await expect(page.getByTestId("mood")).toContainText("sleeping");

  const wake = page.getByRole("button", { name: "Wake up" });
  await expect(wake).toBeEnabled();
  const t1 = await page.evaluate(() => performance.now());
  await wake.click();
  await page.waitForFunction(() => window.__pet?.writes.some((w) => w.kind === "wake"));
  const woke = (await writes(page)).find((x) => x.kind === "wake");
  expect(woke!.at - t1).toBeGreaterThan(1300);
  await expect(page.getByTestId("mood")).not.toContainText("sleeping");
});

test("a flurry of taps gets excited, never more than 20 particles", async ({ page }) => {
  const errors = await open(page);
  let max = 0;
  for (let i = 0; i < 24; i++) {
    await pet(page).click({ delay: 10 });
    max = Math.max(max, await particles(page));
  }
  for (let i = 0; i < 10; i++) {
    max = Math.max(max, await particles(page));
    await page.waitForTimeout(100);
  }
  expect(max).toBeGreaterThan(0);
  expect(max).toBeLessThanOrEqual(20);
  expect(errors).toEqual([]);
});

test("long-press pets: one write on release, happiness up", async ({ page }) => {
  await open(page);
  const joy = page.getByRole("progressbar", { name: "Joy" });
  const before = Number(await joy.getAttribute("aria-valuenow"));
  const box = (await pet(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1600);
  expect((await writes(page)).length).toBe(0);
  expect(Number(await joy.getAttribute("aria-valuenow"))).toBeGreaterThan(before);
  await page.mouse.up();
  await page.waitForTimeout(300);
  const ws = await writes(page);
  expect(ws.map((w) => w.kind)).toEqual(["petted"]);
  expect(ws[0]!.value!).toBeGreaterThan(before + 10);
  expect(ws[0]!.value!).toBeLessThanOrEqual(100);
});

test("the friend's feed replays here with a toast and no write of mine", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Friend feeds" }).click();
  await expect(page.getByRole("button", { name: "Feed", exact: true })).toBeDisabled();
  await page.waitForFunction(() => (window.__pet?.toasts.length ?? 0) > 0);
  expect(await page.evaluate(() => window.__pet?.toasts)).toEqual(["Sam fed Momo 🍪"]);
  await page.waitForTimeout(2200);
  expect((await writes(page)).length).toBe(0);
});

test("level-up counts the badge up", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Level up" }).click();
  await expect(page.getByTestId("mood")).toContainText("level 2");
});

test("Home size: same reactions, no particles", async ({ page }) => {
  const errors = await open(page, "?compact=1");
  for (let i = 0; i < 8; i++) {
    await pet(page).click({ delay: 10 });
    expect(await particles(page)).toBe(0);
  }
  await page.getByRole("button", { name: "Feed", exact: true }).click();
  await page.waitForTimeout(1200);
  expect(await particles(page)).toBe(0);
  expect(errors).toEqual([]);
});

test("reduced motion: actions write straight away", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  const t0 = await page.evaluate(() => performance.now());
  await page.getByRole("button", { name: "Feed", exact: true }).click();
  await page.waitForFunction(() => window.__pet?.writes.some((w) => w.kind === "feed"));
  const w = (await writes(page)).find((x) => x.kind === "feed");
  expect(w!.at - t0).toBeLessThan(400);
  for (let i = 0; i < 6; i++) await pet(page).click({ delay: 10 });
  expect(await particles(page)).toBe(0);
});
