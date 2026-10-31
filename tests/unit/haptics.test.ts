import { afterEach, describe, expect, it, vi } from "vitest";

import { HAPTIC, haptic } from "@/lib/haptics";

describe("haptics", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("has the three named patterns", () => {
    expect(HAPTIC).toEqual({ tap: 10, success: [20, 40, 20], error: [40, 30, 40] });
  });
  it("vibrates with the named pattern when the API exists", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate });
    haptic("tap");
    haptic("success");
    haptic("error");
    expect(vibrate.mock.calls).toEqual([[10], [[20, 40, 20]], [[40, 30, 40]]]);
  });
  it("is a no-op without the API or when it throws", () => {
    vi.stubGlobal("navigator", {});
    expect(() => haptic("tap")).not.toThrow();
    vi.stubGlobal("navigator", {
      vibrate: () => {
        throw new Error("blocked");
      },
    });
    expect(() => haptic("error")).not.toThrow();
  });
});
