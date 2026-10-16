import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/** `pnpm profile:chat`: renders a 300-message thread under React's <Profiler> in happy-dom and prints commit times. */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/perf/**/*.test.tsx"],
    environment: "happy-dom",
    testTimeout: 60_000,
    fileParallelism: false,
  },
});
