/**
 * The CSP is enforced and the app loads without a single violation, in the
 * page *and* in the service worker (whose runtime-cache fetches are governed
 * by connect-src). Images from every host the worker caches are requested so
 * those routes actually run.
 */
import { expect, test, type BrowserContext, type Page, type Worker } from "@playwright/test";

declare global {
  interface Window {
    __csp: string[];
  }
   
  var __cspWorker: string[] | undefined;
}

const WORKER_ROUTED_IMAGES = [
  "https://res.cloudinary.com/demo/image/upload/sample.jpg",
  "https://tile.openstreetmap.org/0/0/0.png",
  "https://media1.giphy.com/media/3o7TKSjRrfIPjeiVyM/200.gif",
  "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  "https://lh3.googleusercontent.com/a/default-user=s96-c",
];

async function watchPage(page: Page) {
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.effectiveDirective} ${e.blockedURI}`));
  });
}

async function controlledWorker(page: Page, context: BrowserContext): Promise<Worker> {
  await page.goto("/signin");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const worker = context.serviceWorkers()[0];
  if (!worker) throw new Error("service worker did not start");
  await worker.evaluate(() => {
    globalThis.__cspWorker = [];
    self.addEventListener("securitypolicyviolation", (e) => {
      const v = e as SecurityPolicyViolationEvent;
      globalThis.__cspWorker?.push(`${v.effectiveDirective} ${v.blockedURI}`);
    });
  });
  return worker;
}

test("/signin is served with an enforced, nonce-based CSP", async ({ page }) => {
  const res = await page.goto("/signin");
  const headers = res?.headers() ?? {};
  expect(headers["content-security-policy-report-only"], "CSP_REPORT_ONLY must be off").toBeUndefined();
  const csp = headers["content-security-policy"] ?? "";
  const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src")) ?? "";
  expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
  expect(scriptSrc).not.toContain("'unsafe-inline'");
  // The theme pre-hydration script (public/theme-init.js) ran and stamped <html>.
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toMatch(/^(light|dark)$/);
});

test("no CSP violations on /signin, in the page or the service worker", async ({ page, context }) => {
  await watchPage(page);
  const worker = await controlledWorker(page, context);
  await expect(page.getByRole("button", { name: /google/i })).toBeVisible();

  // Exercise every worker image route (CacheFirst fetches → connect-src).
  await page.evaluate(async (urls) => {
    await Promise.all(
      urls.map(
        (src) =>
          new Promise<void>((done) => {
            const img = new Image();
            img.onload = img.onerror = () => done();
            img.src = src;
            setTimeout(done, 5000);
          }),
      ),
    );
  }, WORKER_ROUTED_IMAGES);

  const pageViolations = await page.evaluate(() => window.__csp);
  const workerViolations = await worker.evaluate(() => globalThis.__cspWorker ?? []);
  expect(pageViolations, "page violations").toEqual([]);
  expect(workerViolations, "service worker violations").toEqual([]);
});

test("the detectors catch a real violation (self-check)", async ({ page, context }) => {
  await watchPage(page);
  const worker = await controlledWorker(page, context);
  await page.evaluate(() => fetch("https://example.com/").catch(() => undefined));
  await worker.evaluate(() => fetch("https://example.com/").catch(() => undefined));
  await expect.poll(() => page.evaluate(() => window.__csp.length)).toBeGreaterThan(0);
  await expect.poll(() => worker.evaluate(() => globalThis.__cspWorker?.length ?? 0)).toBeGreaterThan(0);
});
