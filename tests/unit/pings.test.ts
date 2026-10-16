import { describe, expect, it } from "vitest";

import { PING_COOLDOWN_MS, pingAllowed, pingCooldownLeft } from "@/lib/pings";

describe("ping cooldown", () => {
  const t0 = 1_000_000;
  it("allows the first ping and blocks a second one inside the window", () => {
    expect(pingAllowed(null, t0)).toBe(true);
    expect(pingAllowed(t0, t0 + 10)).toBe(false);
    expect(pingAllowed(t0, t0 + PING_COOLDOWN_MS - 1)).toBe(false);
    expect(pingAllowed(t0, t0 + PING_COOLDOWN_MS)).toBe(true);
  });
  it("reports how long is left", () => {
    expect(pingCooldownLeft(null, t0)).toBe(0);
    expect(pingCooldownLeft(t0, t0 + 2000)).toBe(PING_COOLDOWN_MS - 2000);
    expect(pingCooldownLeft(t0, t0 + 9000)).toBe(0);
  });
});
