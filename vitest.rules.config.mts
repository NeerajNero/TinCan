import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/** Security-rules and emulator integration tests; run through `pnpm test:rules` so the emulators are up. */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/rules.test.ts", "tests/trivia-live.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
