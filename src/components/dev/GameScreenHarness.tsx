"use client";

import { useState } from "react";

import { LetterKeyboard } from "@/components/games/LetterKeyboard";
import { HangmanFigure, WordTiles } from "@/components/play/boards/HangmanBoard";
import { GameScreen } from "@/components/play/GameScreen";
import { WordleGrid } from "@/components/play/WordleGrid";
import { Card } from "@/components/ui/Card";

/**
 * Test-only: the GameScreen composite inside a stand-in for the app shell
 * (fixed column, `<main>` as the only scroller, a tab-bar-sized last row), as
 * the daily word and Hangman use it, so Playwright can check the dock stays in
 * the viewport, nothing but the content area scrolls and the keyboard fits.
 */
export function GameScreenHarness({ screen }: { screen: "word" | "hangman" }) {
  const [draft, setDraft] = useState("pl");
  const [guessed, setGuessed] = useState("etaoin");
  const header = (
    <header className="flex items-center gap-2 px-1" data-game-header>
      <span className="text-3xl" aria-hidden>
        {screen === "word" ? "🟩" : "🪢"}
      </span>
      <h1 className="min-w-0 flex-1 truncate text-2xl font-semibold">{screen === "word" ? "Daily word" : "Hangman"}</h1>
    </header>
  );
  return (
    <div className="fixed inset-0 mx-auto flex w-full max-w-[480px] flex-col">
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-4 pt-4 pb-6" data-main>
        {screen === "word" ? (
          <GameScreen header={header} dock={<LetterKeyboard withActions label="Keyboard" states={{ c: "absent", r: "present", a: "correct", n: "absent", e: "absent", s: "absent", l: "correct", t: "present" }} onKey={(k) => setDraft((d) => (k === "back" ? d.slice(0, -1) : k === "enter" ? "" : (d + k).slice(0, 5)))} />}>
            <div className="relative">
              <WordleGrid guesses={["crane", "slate"]} draft={draft} answer="plant" shake={0} reveal />
            </div>
          </GameScreen>
        ) : (
          <GameScreen
            header={
              <>
                {header}
                <div className="card flex items-center gap-3 rounded-[20px] px-3 py-2 text-sm">
                  <span className="font-semibold">Sam</span>
                  <span className="text-xs text-muted">vs</span>
                  <span className="font-semibold">Priya</span>
                  <span className="ml-auto font-bold">Your turn</span>
                </div>
              </>
            }
            dock={
              <LetterKeyboard
                states={Object.fromEntries(guessed.split("").map((k) => [k, "aeiou".includes(k) ? "correct" : "absent"]))}
                isDisabled={(k) => guessed.includes(k)}
                onKey={(k) => setGuessed((g) => (g.includes(k) ? g : g + k))}
                keyLabel={(k) => `Guess ${k.toUpperCase()}`}
              />
            }
          >
            <p className="text-center text-xs font-bold text-muted">Round 1 of 3 · You 0 – 0 Priya</p>
            <Card className="flex flex-col items-center gap-3">
              <HangmanFigure wrong={3} />
              <WordTiles mask="_a_ _ e" shown="_a_ _ e" revealedToSetter={false} />
              <p className="text-xs text-muted">3/6 misses · tried t n</p>
            </Card>
          </GameScreen>
        )}
      </main>
      <div className="h-[76px] shrink-0" data-tabbar aria-hidden />
    </div>
  );
}
