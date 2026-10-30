"use client";

import { AnimatePresence, m } from "framer-motion";
import { useEffect, useState } from "react";

import { LetterKeyboard } from "@/components/games/LetterKeyboard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import answers from "@/content/words-answers.json";
import { useRtdbValue } from "@/hooks/useRtdbValue";
import { cn } from "@/lib/cn";
import { guessHangmanLetter, privateGamePath, setHangmanWord, type LiveGame } from "@/lib/db/games";
import { currentRound, HANGMAN_MAX_LEN, HANGMAN_MAX_WRONG, HANGMAN_ROUNDS, type HangmanRound, type HangmanState } from "@/lib/games/hangman";
import { other, type Player } from "@/lib/games/types";
import { errorMessage } from "@/lib/swallow";
import { fetchDefinition, type WordDefinition } from "@/lib/wordDefinitions";

const WORDS = answers as string[];
const randomWord = () => WORDS[Math.floor(Math.random() * WORDS.length)] ?? "apple";

interface PrivateWord {
  word?: string;
  round?: number;
}

/**
 * Hangman: the setter types (or draws) a word, the guesser taps letters, the
 * figure builds up to six misses. The setter's own phone reads its word from
 * the owner-only subtree; the guesser's never has it until the round ends.
 */
export function HangmanBoard({ game, state, me, uid, nameOf }: { game: LiveGame; state: HangmanState; me: Player | null; uid: string; nameOf: (uid: string) => string }) {
  const round = currentRound(state);
  const setter = round.setter;
  const iAmSetter = me === setter;
  const active = game.status === "active";
  const name = (p: Player) => (p === me ? "You" : nameOf(p === "first" ? game.players.first : game.players.second));
  const priv = useRtdbValue<PrivateWord>(iAmSetter && active ? privateGamePath(game.id, uid) : null).value;
  const myWord = iAmSetter && priv?.round === state.round ? (priv.word ?? null) : null;
  const previous = state.phase === "setting" && state.round > 0 ? state.rounds[state.round - 1] : null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-center text-xs font-bold text-muted" aria-live="polite">
        Round {Math.min(state.round + 1, HANGMAN_ROUNDS)} of {HANGMAN_ROUNDS} · {name("first")} {state.scores.first} – {state.scores.second} {name("second")}
      </p>

      {state.phase === "done" ? (
        <div className="flex flex-col gap-2">
          {state.rounds.map((r, i) => (
            <RoundCard key={i} index={i} round={r} name={name} />
          ))}
        </div>
      ) : (
        <>
          {previous && <RoundCard index={state.round - 1} round={previous} name={name} />}
          {state.phase === "setting" && iAmSetter && active && <SetWord game={game} uid={uid} />}
          {state.phase === "setting" && !iAmSetter && (
            <Card className="flex items-center gap-3 py-6 text-center">
              <Figure wrong={0} />
              <p className="min-w-0 flex-1 text-sm text-muted">Waiting for {name(setter)} to pick a word…</p>
            </Card>
          )}
          {state.phase === "guessing" && <Guessing game={game} state={state} round={round} iAmSetter={iAmSetter} myWord={myWord} canGuess={active && me === other(setter)} setterName={name(setter)} />}
        </>
      )}
    </div>
  );
}

function SetWord({ game, uid }: { game: LiveGame; uid: string }) {
  const [word, setWord] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(w: string) {
    setBusy(true);
    setError(null);
    try {
      const reason = await setHangmanWord(game, uid, w);
      if (reason) setError(reason);
    } catch (err) {
      setError(errorMessage(err, "Couldn't set the word"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <p className="font-heading text-lg font-semibold">Pick a word for them to guess</p>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(word);
        }}
      >
        <Input value={word} onChange={(e) => setWord(e.target.value)} maxLength={HANGMAN_MAX_LEN} placeholder="A word or a short phrase" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-label="Word to guess" />
        <p className="text-xs text-muted">Letters and spaces, up to {HANGMAN_MAX_LEN} characters. It stays secret until the round ends.</p>
        {error && <p className="text-xs font-bold text-red-500">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="soft" disabled={busy} onClick={() => void submit(randomWord())} className="flex-1 py-2.5 text-sm">
            🎲 Random word
          </Button>
          <Button type="submit" disabled={busy || !word.trim()} className="flex-1 py-2.5 text-sm">
            Set word
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Guessing({ game, state, round, iAmSetter, myWord, canGuess, setterName }: { game: LiveGame; state: HangmanState; round: HangmanRound; iAmSetter: boolean; myWord: string | null; canGuess: boolean; setterName: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shown = myWord && myWord.length === round.mask.length ? myWord : round.mask;

  async function guess(letter: string) {
    if (!canGuess || busy || round.guessed.includes(letter)) return;
    setBusy(letter);
    setError(null);
    try {
      await guessHangmanLetter(game.id, letter);
    } catch (err) {
      setError(errorMessage(err, "That guess didn't go through"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="flex flex-col items-center gap-3">
      <Figure wrong={round.wrong} />
      <WordTiles mask={round.mask} shown={shown} revealedToSetter={iAmSetter} />
      <p className="text-xs text-muted" aria-live="polite">
        {round.wrong}/{HANGMAN_MAX_WRONG} misses{round.guessed ? ` · tried ${round.guessed.split("").join(" ")}` : ""}
      </p>
      {iAmSetter && <p className="text-center text-xs text-muted">Only you can see the letters. {state.phase === "guessing" ? "Sit tight while they guess." : ""}</p>}
      {!iAmSetter && !canGuess && <p className="text-center text-xs text-muted">{setterName}&apos;s word — the round is theirs to watch.</p>}
      {canGuess && (
        <LetterKeyboard
          states={Object.fromEntries(round.guessed.split("").map((k) => [k, round.mask.includes(k) ? "correct" : "absent"]))}
          isDisabled={(k) => round.guessed.includes(k)}
          disabled={busy !== null}
          pending={busy}
          onKey={(k) => void guess(k)}
          keyLabel={(k) => `Guess ${k.toUpperCase()}`}
        />
      )}
      {error && <p className="text-xs font-bold text-red-500">{error}</p>}
    </Card>
  );
}

function WordTiles({ mask, shown, revealedToSetter }: { mask: string; shown: string; revealedToSetter: boolean }) {
  const words = shown.split(" ");
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2" aria-label={`Word: ${mask.split("").join(" ")}`}>
      {words.map((w, wi) => (
        <span key={wi} className="flex gap-1">
          {w.split("").map((ch, i) => {
            const hidden = mask.split(" ")[wi]?.[i] === "_";
            return (
              <span key={i} className={cn("grid h-9 w-7 place-items-center border-b-4 font-heading text-xl font-semibold uppercase", hidden ? (revealedToSetter ? "border-muted/40 text-muted" : "border-[var(--accent)] text-transparent") : "border-[var(--accent)]")}>
                {hidden && !revealedToSetter ? "" : ch}
              </span>
            );
          })}
        </span>
      ))}
    </div>
  );
}

function RoundCard({ index, round, name }: { index: number; round: HangmanRound; name: (p: Player) => string }) {
  const guesser = other(round.setter);
  const word = round.word ?? "";
  const [def, setDef] = useState<WordDefinition | null>(null);
  useEffect(() => {
    if (!word || word.includes(" ")) return;
    let live = true;
    fetchDefinition(word)
      .then((d) => live && setDef(d))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [word]);
  return (
    <Card className="flex flex-col gap-1 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">Round {index + 1}</p>
      <p className="font-heading text-lg font-semibold">
        {word ? <span className="uppercase">{word}</span> : "…"} · {round.result === "won" ? `${name(guesser)} got it` : `${name(round.setter)}'s word held`}
        {round.result === "won" && ` in ${round.guessed.length}`}
      </p>
      {def && (
        <p className="text-sm text-muted">
          <span className="italic">{def.pos}</span> — {def.meaning}
          {def.example && <span className="block text-xs">“{def.example}”</span>}
        </p>
      )}
    </Card>
  );
}

/** Gallows plus up to six body parts, each fading in as misses mount. */
function Figure({ wrong }: { wrong: number }) {
  const part = (i: number) => wrong > i;
  const stroke = { stroke: "var(--text)", strokeWidth: 4, strokeLinecap: "round" as const, fill: "none" };
  return (
    <svg viewBox="0 0 120 140" className="h-36 w-32 shrink-0" aria-label={`${wrong} of ${HANGMAN_MAX_WRONG} misses`} role="img">
      <path d="M10 134 H70 M30 134 V12 H84 V30" {...stroke} opacity={0.7} />
      <AnimatePresence>
        {part(0) && <m.circle key="head" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} cx={84} cy={44} r={14} {...stroke} />}
        {part(1) && <m.path key="body" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} d="M84 58 V96" {...stroke} />}
        {part(2) && <m.path key="larm" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} d="M84 68 L64 84" {...stroke} />}
        {part(3) && <m.path key="rarm" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} d="M84 68 L104 84" {...stroke} />}
        {part(4) && <m.path key="lleg" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} d="M84 96 L68 122" {...stroke} />}
        {part(5) && <m.path key="rleg" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} d="M84 96 L100 122" {...stroke} />}
      </AnimatePresence>
      {wrong >= HANGMAN_MAX_WRONG && (
        <g fill="none" stroke="var(--text)" strokeWidth={2.5} strokeLinecap="round">
          <path d="M77 40 l5 5 m0 -5 l-5 5 M86 40 l5 5 m0 -5 l-5 5" />
        </g>
      )}
    </svg>
  );
}
