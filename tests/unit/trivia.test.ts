import { describe, expect, it } from "vitest";

import { pointsFor, QUESTION_MS, REVEAL_MS, shuffledOptions, TRIVIA_BANK } from "@/lib/trivia";

describe("trivia bank", () => {
  it("has ids matching positions and four options with a valid answer", () => {
    TRIVIA_BANK.forEach((q, i) => {
      expect(q.id, q.q).toBe(i);
      expect(q.options, q.q).toHaveLength(4);
      expect(q.answer, q.q).toBeGreaterThanOrEqual(0);
      expect(q.answer, q.q).toBeLessThan(4);
    });
  });
  it("gives every question a one-line explanation (1–140 chars)", () => {
    for (const q of TRIVIA_BANK) {
      expect(typeof q.explanation, q.q).toBe("string");
      expect(q.explanation.trim().length, q.q).toBeGreaterThan(0);
      expect(q.explanation.length, q.q).toBeLessThanOrEqual(140);
      expect(q.explanation, q.q).not.toMatch(/\n/);
    }
  });
  it("keeps the right answer after shuffling", () => {
    for (const q of TRIVIA_BANK.slice(0, 20)) {
      const { options, answer } = shuffledOptions(q, 12345);
      expect(options[answer]).toBe(q.options[q.answer]);
    }
  });
  it("scores speed and leaves room to read the reveal", () => {
    expect(pointsFor({ choice: 0, ms: 0, correct: true })).toBe(15);
    expect(pointsFor({ choice: 0, ms: QUESTION_MS, correct: true })).toBe(10);
    expect(pointsFor({ choice: 1, ms: 100, correct: false })).toBe(0);
    expect(REVEAL_MS).toBeGreaterThanOrEqual(3000);
  });
});
