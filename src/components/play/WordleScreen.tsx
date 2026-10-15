"use client";

import { onSnapshot } from "firebase/firestore";
import { AnimatePresence, motion } from "framer-motion";
import { Delete } from "lucide-react";
import { useEffect, useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { Confetti } from "@/components/plan/Confetti";
import { Card } from "@/components/ui/Card";
import { useNow } from "@/hooks/useNow";
import { usePair } from "@/hooks/usePair";
import { cn } from "@/lib/cn";
import { roomDateKey } from "@/lib/dates";
import { saveGuesses, wordleRef, type WordleDoc } from "@/lib/db/wordle";
import { recordTogetherEvent } from "@/lib/garden";
import { notify } from "@/lib/notify";
import { evaluate, isAllowedGuess, KEY_ROWS, keyboardStates, MAX_GUESSES, WORD_LEN, wordFor, type LetterState } from "@/lib/wordle";

const TILE: Record<LetterState, string> = { correct: "bg-emerald-500 text-white border-emerald-500", present: "bg-amber-400 text-white border-amber-400", absent: "bg-muted/60 text-white border-muted/60" };

export function WordleScreen() {
  const { uid, me, friend, friendUid, pair } = usePair();
  const now = useNow(60_000);
  const today = roomDateKey(pair, now);
  const answer = wordFor(today);
  const [mine, setMine] = useState<WordleDoc | null | undefined>(undefined);
  const [theirs, setTheirs] = useState<WordleDoc | null>(null);
  const [draft, setDraft] = useState("");
  const [shake, setShake] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    const a = onSnapshot(wordleRef(today, uid), (snap) => setMine(snap.exists() ? snap.data() : null));
    const b = friendUid ? onSnapshot(wordleRef(today, friendUid), (snap) => setTheirs(snap.exists() ? snap.data() : null)) : () => undefined;
    return () => {
      a();
      b();
    };
  }, [today, uid, friendUid]);

  const guesses = mine?.guesses ?? [];
  const done = mine?.done ?? false;
  const keyStates = keyboardStates(guesses, answer);

  function flash(msg: string) {
    setToast(msg);
    setShake((s) => s + 1);
    setTimeout(() => setToast(null), 1200);
  }

  async function submit() {
    if (done || draft.length !== WORD_LEN) return flash("Five letters");
    if (!isAllowedGuess(draft)) return flash("Not in the word list");
    const next = [...guesses, draft.toLowerCase()];
    const solved = draft.toLowerCase() === answer;
    const finished = solved || next.length >= MAX_GUESSES;
    setDraft("");
    await saveGuesses(today, uid, next, solved, finished);
    if (solved) {
      setBurst((b) => b + 1);
      void recordTogetherEvent("word", uid);
    }
    if (finished && friendUid) {
      void notify("yourTurn", { toUid: friendUid, body: solved ? `solved today's word in ${next.length} 🟩 — your go` : "finished today's word — your go", data: { url: "/play/word" } });
    }
  }

  function onKey(k: string) {
    if (done) return;
    if (k === "enter") void submit();
    else if (k === "back") setDraft((d) => d.slice(0, -1));
    else if (/^[a-z]$/.test(k) && draft.length < WORD_LEN) setDraft((d) => d + k);
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "enter" || k === "backspace" || /^[a-z]$/.test(k)) {
        e.preventDefault();
        onKey(k === "backspace" ? "back" : k);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const bothDone = done && theirs?.done;
  const myCount = mine?.solved ? guesses.length : null;
  const theirCount = theirs?.solved ? theirs.guesses.length : null;
  const winner = bothDone ? (myCount === theirCount ? null : myCount === null ? "them" : theirCount === null ? "me" : myCount < theirCount ? "me" : "them") : null;

  return (
    <div className="flex flex-col gap-4">
      <SubHeader emoji="🟩" title="Daily word" back="/play" screenName="Daily word" />
      {mine === undefined && <Card className="py-8 text-center text-muted">Loading…</Card>}

      {mine !== undefined && (
        <>
          <div className="relative mx-auto w-full max-w-[320px]">
            <AnimatePresence>
              {toast && (
                <motion.p key={toast} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-x-0 -top-8 z-10 text-center text-sm font-bold">
                  {toast}
                </motion.p>
              )}
            </AnimatePresence>
            <Grid guesses={guesses} draft={done ? "" : draft} answer={answer} shake={shake} reveal />
          </div>

          {done && (
            <Card className="flex flex-col items-center gap-1 text-center">
              <p className="font-heading text-xl font-semibold">{mine?.solved ? `Got it in ${guesses.length}! 🎉` : `It was “${answer.toUpperCase()}”`}</p>
              <p className="text-xs text-muted">{theirs?.done ? "Both done — compare below" : `Waiting for ${friend?.nickname ?? "them"}`}</p>
            </Card>
          )}

          {!done && <Keyboard states={keyStates} onKey={onKey} />}

          {bothDone && theirs && (
            <Card className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col items-center gap-1">
                  <p className="text-xs font-bold">
                    {winner === "me" && "🏆 "}
                    {me.nickname} · {myCount ?? "✗"}
                  </p>
                  <Grid guesses={guesses} draft="" answer={answer} shake={0} compact />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <p className="text-xs font-bold">
                    {winner === "them" && "🏆 "}
                    {friend?.nickname ?? "Friend"} · {theirCount ?? "✗"}
                  </p>
                  <Grid guesses={theirs.guesses} draft="" answer={answer} shake={0} compact />
                </div>
              </div>
              <p className="text-center text-xs text-muted">{winner === null ? "Dead heat today" : winner === "me" ? "Fewer guesses — you take it" : "They were quicker today"}</p>
            </Card>
          )}
          {done && theirs && !theirs.done && <p className="text-center text-xs text-muted">{friend?.nickname} is still on it — no peeking at their grid until they finish.</p>}
        </>
      )}
      <Confetti burst={burst} />
    </div>
  );
}

function Grid({ guesses, draft, answer, shake, compact, reveal }: { guesses: string[]; draft: string; answer: string; shake: number; compact?: boolean; reveal?: boolean }) {
  const rows = Array.from({ length: MAX_GUESSES }, (_, r) => guesses[r] ?? (r === guesses.length ? draft : ""));
  return (
    <div className={cn("grid gap-1", compact ? "w-[120px]" : "w-full")} style={{ gridTemplateRows: `repeat(${MAX_GUESSES}, 1fr)` }}>
      {rows.map((row, r) => {
        const submitted = r < guesses.length;
        const states = submitted ? evaluate(row, answer) : null;
        const isDraftRow = r === guesses.length;
        return (
          <motion.div key={r} className="grid grid-cols-5 gap-1" animate={isDraftRow && shake ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }} transition={{ duration: 0.35 }}>
            {Array.from({ length: WORD_LEN }, (_, c) => {
              const ch = row[c] ?? "";
              const st = states?.[c];
              return (
                <motion.span
                  key={c}
                  initial={false}
                  animate={reveal && submitted ? { rotateX: [90, 0] } : { rotateX: 0 }}
                  transition={{ delay: reveal ? c * 0.12 : 0, duration: 0.25 }}
                  className={cn(
                    "grid aspect-square place-items-center rounded-lg border-2 font-heading font-bold uppercase",
                    compact ? "text-xs" : "text-2xl",
                    st ? TILE[st] : ch ? "border-muted/60" : "border-border",
                  )}
                >
                  {compact ? "" : ch}
                </motion.span>
              );
            })}
          </motion.div>
        );
      })}
    </div>
  );
}

function Keyboard({ states, onKey }: { states: Record<string, LetterState>; onKey: (k: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      {KEY_ROWS.map((row, i) => (
        <div key={row} className="flex gap-1">
          {i === 2 && (
            <button type="button" onClick={() => onKey("enter")} className="tap h-12 rounded-lg bg-surface-2 px-3 text-xs font-bold">
              ENTER
            </button>
          )}
          {row.split("").map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onKey(k)}
              aria-label={k}
              className={cn("h-12 w-8 rounded-lg text-sm font-bold uppercase", states[k] ? TILE[states[k]] : "bg-surface-2")}
            >
              {k}
            </button>
          ))}
          {i === 2 && (
            <button type="button" onClick={() => onKey("back")} aria-label="Backspace" className="tap grid h-12 place-items-center rounded-lg bg-surface-2 px-3">
              <Delete size={18} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
