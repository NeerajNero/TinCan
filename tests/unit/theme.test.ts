import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { themeInitScript } from "@/lib/theme";

describe("theme pre-hydration script", () => {
  it("public/theme-init.js is exactly lib/theme's script (same storage key, same logic)", () => {
    const file = readFileSync(resolve(__dirname, "../../public/theme-init.js"), "utf8").trim();
    expect(file).toBe(themeInitScript);
  });
});
