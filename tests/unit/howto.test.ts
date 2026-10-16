import { describe, expect, it } from "vitest";

import { HOWTO } from "@/content/howto";

// An emoji (incl. keycaps like 6️⃣ and ZWJ sequences) at the very start of a line.
const STARTS_WITH_EMOJI = /^(\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]️?⃣)/u;

describe("how-to content", () => {
  it("covers every game, together activity and slow feature", () => {
    expect(Object.keys(HOWTO).sort()).toEqual(
      ["calls", "capsules", "checkers", "chess", "connectfour", "convo", "cook", "daily", "envelopes", "garden", "jar", "listen", "nhie", "pet", "pictionary", "pixel", "plant", "quiz", "radio", "tictactoe", "timer", "tod", "trivia", "twenty", "watch", "wheel", "whiteboard", "word", "wyr"].sort(),
    );
  });
  it.each(Object.entries(HOWTO))("%s: 3–4 short steps, each starting with an emoji, plus a label", (_key, h) => {
    expect(h.title.length).toBeGreaterThan(0);
    expect(h.label.length).toBeLessThanOrEqual(40);
    expect(h.steps.length).toBeGreaterThanOrEqual(3);
    expect(h.steps.length).toBeLessThanOrEqual(4);
    for (const step of h.steps) {
      expect(step, step).toMatch(STARTS_WITH_EMOJI);
      expect(step.length, step).toBeLessThanOrEqual(80);
    }
    if (h.tip) expect(h.tip.length).toBeLessThanOrEqual(90);
  });
});
