import { defineConfig } from "vitest/config";

/** Security-rules tests; run through `pnpm test:rules` so the emulators are up. */
export default defineConfig({
  test: {
    include: ["tests/rules.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
