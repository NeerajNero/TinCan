"use client";

import { useState } from "react";

import { LetterKeyboard } from "@/components/games/LetterKeyboard";
import { Card } from "@/components/ui/Card";

/**
 * Test-only: both keyboards (Hangman's letters-only one with used keys, the
 * daily word's with Enter / Backspace) inside the app's column and card padding,
 * so Playwright can measure that neither overflows at narrow widths.
 */
export function KeyboardHarness() {
  const [guessed, setGuessed] = useState("etaoin");
  const [typed, setTyped] = useState("");
  return (
    <div className="mx-auto flex max-w-[480px] flex-col gap-4 px-4 py-4">
      <Card className="flex flex-col gap-3" data-testid="hangman">
        <p className="text-xs text-muted">Hangman · tried {guessed.split("").join(" ")}</p>
        <LetterKeyboard
          states={Object.fromEntries(guessed.split("").map((k) => [k, "aeiou".includes(k) ? "correct" : "absent"]))}
          isDisabled={(k) => guessed.includes(k)}
          onKey={(k) => setGuessed((g) => (g.includes(k) ? g : g + k))}
          keyLabel={(k) => `Guess ${k.toUpperCase()}`}
        />
      </Card>
      <Card className="flex flex-col gap-3" data-testid="word">
        <p className="text-xs text-muted">Daily word · {typed || "…"}</p>
        <LetterKeyboard withActions label="Keyboard" states={{ s: "correct", t: "present", r: "absent" }} onKey={(k) => setTyped((t) => (k === "back" ? t.slice(0, -1) : k === "enter" ? "" : (t + k).slice(0, 5)))} />
      </Card>
    </div>
  );
}
