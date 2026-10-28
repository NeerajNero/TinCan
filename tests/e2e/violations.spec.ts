/**
 * Self-check for the shared collector (violations.ts): the two known
 * third-party messages are ignored, and look-alikes from anywhere else are
 * still collected. Uses /signin for the real CSP and Permissions-Policy, and a
 * stubbed youtube-nocookie.com frame (page.route) so it needs no network.
 */
import { expect, test } from "@playwright/test";

import { collectErrors, cspNoiseReason, noiseReason } from "./violations";

const PRESSURE_PROBE = `<script>new PressureObserver(() => {}).observe("cpu").catch(() => {});</script>`;

test("YouTube's compute-pressure probe and Google's gen_204 beacon are ignored", async ({ page }) => {
  await page.route("https://www.youtube-nocookie.com/e2e-probe", (r) => r.fulfill({ contentType: "text/html", body: PRESSURE_PROBE }));
  const seen: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") seen.push(m.text());
  });
  await page.goto("/signin");
  const errors = collectErrors(page);
  await page.evaluate(async () => {
    const f = document.createElement("iframe");
    f.src = "https://www.youtube-nocookie.com/e2e-probe";
    document.body.appendChild(f);
    await fetch("https://apis.google.com/js/gen_204?c=50%3A1").catch(() => undefined);
  });
  // Both really happened (so the test proves the filter, not their absence)…
  await expect.poll(() => seen.some((t) => t.includes("compute-pressure")), { timeout: 10_000 }).toBe(true);
  await expect.poll(() => seen.some((t) => t.includes("apis.google.com/js/gen_204"))).toBe(true);
  // …and none of it was collected.
  expect(errors).toEqual([]);
});

test("look-alikes still count", async ({ page }) => {
  await page.goto("/signin");
  const errors = collectErrors(page);
  await page.evaluate(() => fetch("https://apis.google.com/js/api.js").catch(() => undefined));
  await expect.poll(() => errors.some((t) => t.includes("apis.google.com/js/api.js"))).toBe(true);

  const pressure = "Permissions policy violation: compute-pressure is not allowed in this document.";
  expect(noiseReason(pressure, "https://www.youtube-nocookie.com/embed/x")).not.toBeNull();
  expect(noiseReason(pressure, "https://www.youtube.com/s/player/base.js")).not.toBeNull();
  expect(noiseReason(pressure, "http://127.0.0.1:3100/e2e/youtube")).toBeNull();
  expect(noiseReason(pressure, "https://www.youtube.com.evil.example/x")).toBeNull();
  expect(noiseReason(pressure, "")).toBeNull();
  expect(noiseReason("Permissions policy violation: camera is not allowed in this document.", "https://www.youtube-nocookie.com/embed/x")).toBeNull();
  expect(noiseReason("Fetch API cannot load https://apis.google.com/js/gen_2040. Refused to connect because it violates the document's Content Security Policy.", "")).toBeNull();
  expect(noiseReason("Connecting to 'https://evil.example/apis.google.com/js/gen_204' violates the following Content Security Policy directive", "")).toBeNull();
  // The raw CSP event form used by csp.spec.ts: only connect-src + that exact path.
  expect(cspNoiseReason("connect-src https://apis.google.com/js/gen_204?c=50%3A1")).toBe("Google gen_204 beacon");
  expect(cspNoiseReason("img-src https://apis.google.com/js/gen_204")).toBeNull();
  expect(cspNoiseReason("connect-src https://apis.google.com/js/api.js")).toBeNull();
  expect(cspNoiseReason("connect-src https://example.com/")).toBeNull();
});
