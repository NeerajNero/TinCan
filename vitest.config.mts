import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * `pnpm test` runs the unit tests (pure engines and helpers, no Firebase).
 * `pnpm test:rules` runs tests/rules.test.ts against the emulators separately.
 */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
