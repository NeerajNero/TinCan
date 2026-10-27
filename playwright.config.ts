import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke tests against a production build (`pnpm test:e2e` builds first).
 * No sign-in needed: they cover the public pages and the global layout lock.
 */
const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  // CI: annotations in the run + an HTML report uploaded as an artifact on failure.
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "android", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `E2E_HARNESS=1 pnpm exec next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/signin`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
