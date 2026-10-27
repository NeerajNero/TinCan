"use client";

import { AnimatePresence, m } from "framer-motion";
import { Delete } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { Confetti } from "@/components/plan/Confetti";
import { TILE, WordleGrid } from "@/components/play/WordleGrid";
import { WordleHistory } from "@/components/play/WordleHistory";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useNow } from "@/hooks/useNow";
import { usePair } from "@/hooks/usePair";
import { cn } from "@/lib/cn";
import { roomDateKey } from "@/lib/dates";
import { sendText } from "@/lib/db/messages";
import { saveGuesses, settleWordleDay, wordleRef, type WordleDoc } from "@/lib/db/wordle";
import { onSnapshot } from "@/lib/firebase/fs";
import { recordTogetherEvent } from "@/lib/garden";
import { readPref, writePref } from "@/lib/localPref";
import { notify } from "@/lib/notify";
import { definitionHeading, fetchDefinition, type WordDefinition } from "@/lib/wordDefinitions";
import { isAllowedGuess, KEY_ROWS, keyboardStates, MAX_GUESSES, shareText, WORD_LEN, wordFor, type LetterState } from "@/lib/wordle";
import { bothFinished, guessCount, iRecordWordle, wordleDayWinner, type WordleDay } from "@/lib/wordleResults";

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
  // Definition lookup, only on request and only once finished; keyed by word so a new day starts blank.
  const [lookup, setLookup] = useState<{ word: string; state: MeaningState } | null>(null);
  const meaning: MeaningState = lookup?.word === answer ? lookup.state : "idle";

  // Share the grid to chat once per day (per device).
  const SHARED_KEY = "tincan:word-shared";
  const [shared, setShared] = useState<string | null>(() => readPref(SHARED_KEY));
  const [sharing, setSharing] = useState(false);
  async function share() {
    if (!mine || sharing || shared === today) return;
    setSharing(true);
    try {
      const text = shareText(today, mine.guesses, answer);
      const id = await sendText(uid, text, null);
      writePref(SHARED_KEY, today);
      setShared(today);
      if (friendUid) void notify("message", { toUid: friendUid, body: text.split("\n")[0] ?? "Daily word", data: { messageId: id } });
    } catch {
      flash("Couldn't share — try again");
    } finally {
      setSharing(false);
    }
  }

  function askMeaning() {
    setLookup({ word: answer, state: "loading" });
    fetchDefinition(answer)
      .then((def) => setLookup({ word: answer, state: def ?? "none" }))
      .catch(() => setLookup({ word: answer, state: "error" }));
  }

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

  const bothDone = Boolean(mine && theirs && bothFinished(mine, theirs));
  const myCount = guessCount(mine ?? undefined);
  const theirCount = guessCount(theirs ?? undefined);
  const winnerUid = bothDone && mine && theirs && friendUid ? wordleDayWinner(uid, friendUid, mine, theirs) : null;
  const winner = winnerUid === null ? null : winnerUid === uid ? "me" : "them";
  const nameOf = (id: string) => (id === uid ? me.nickname : (friend?.nickname ?? "Friend"));
  const todayDay: WordleDay | null = bothDone && mine && theirs && friendUid ? { dateKey: today, word: answer, docs: { [uid]: mine, [friendUid]: theirs } } : null;

  // Settle the day once both grids are in: the later finisher records it (create-once, so a repeat is harmless).
  const settled = useRef<string | null>(null);
  useEffect(() => {
    if (!todayDay || !mine || !theirs || !friendUid || settled.current === today) return;
    if (!iRecordWordle(uid, friendUid, mine.at?.toMillis() ?? null, theirs.at?.toMillis() ?? null)) return;
    settled.current = today;
    void settleWordleDay(todayDay, uid, friendUid, pair, nameOf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayDay, today, uid, friendUid]);

  return (
    <div className="flex flex-col gap-4">
      <SubHeader help="word" emoji="🟩" title="Daily word" back="/play" screenName="Daily word" invite={{ activity: "word", route: "/play/word", label: "the Daily word" }} />
      {mine === undefined && <Card className="py-8 text-center text-muted">Loading…</Card>}

      {mine !== undefined && (
        <>
          <div className="relative mx-auto w-full max-w-[320px]">
            <AnimatePresence>
              {toast && (
                <m.p key={toast} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-x-0 -top-8 z-10 text-center text-sm font-bold">
                  {toast}
                </m.p>
              )}
            </AnimatePresence>
            <WordleGrid guesses={guesses} draft={done ? "" : draft} answer={answer} shake={shake} reveal />
          </div>

          {done && (
            <Card className="flex flex-col items-center gap-1 text-center">
              <p className="font-heading text-xl font-semibold">{mine?.solved ? `Got it in ${guesses.length}! 🎉` : `It was “${answer.toUpperCase()}”`}</p>
              <p className="text-xs text-muted">{theirs?.done ? "Both done — compare below" : `Waiting for ${friend?.nickname ?? "them"}`}</p>
              <Meaning word={answer} state={meaning} onAsk={askMeaning} />
              <Button variant="soft" onClick={() => void share()} disabled={sharing || shared === today} className="px-4 py-2 text-sm">
                {shared === today ? "Shared to chat ✓" : sharing ? "Sharing…" : "Share my grid to chat"}
              </Button>
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
                  <WordleGrid guesses={guesses} draft="" answer={answer} shake={0} compact />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <p className="text-xs font-bold">
                    {winner === "them" && "🏆 "}
                    {friend?.nickname ?? "Friend"} · {theirCount ?? "✗"}
                  </p>
                  <WordleGrid guesses={theirs.guesses} draft="" answer={answer} shake={0} compact />
                </div>
              </div>
              <p className="text-center text-xs text-muted">{winner === null ? "Dead heat today" : winner === "me" ? "Fewer guesses — you take it" : "They were quicker today"}</p>
              {typeof meaning === "object" && <Meaning word={answer} state={meaning} onAsk={askMeaning} />}
            </Card>
          )}
          {done && theirs && !theirs.done && <p className="text-center text-xs text-muted">{friend?.nickname} is still on it — no peeking at their grid until they finish.</p>}
          {friendUid && <WordleHistory today={today} me={uid} friend={friendUid} pair={pair} nameOf={nameOf} todayDay={todayDay} />}
        </>
      )}
      <Confetti burst={burst} />
    </div>
  );
}

type MeaningState = "idle" | "loading" | "none" | "error" | WordDefinition;

/** "ACORN · noun — meaning" with the example underneath; before that, the "What does it mean?" link. */
function Meaning({ word, state, onAsk }: { word: string; state: MeaningState; onAsk: () => void }) {
  if (state === "idle" || state === "error") {
    return (
      <button type="button" onClick={onAsk} className="tap mt-1 min-h-11 px-3 text-sm font-bold text-[var(--accent)] underline-offset-4 hover:underline">
        {state === "error" ? "Couldn't load it — try again?" : "What does it mean?"}
      </button>
    );
  }
  if (state === "loading") return <p className="mt-1 min-h-11 pt-3 text-sm text-muted">Looking it up…</p>;
  if (state === "none") return <p className="mt-1 min-h-11 pt-3 text-sm text-muted">No definition for this one — rare word!</p>;
  return (
    <m.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-1 flex flex-col gap-0.5 px-2 text-center">
      <p className="text-sm">
        <span className="font-heading font-semibold">{definitionHeading(word, state)}</span>
        <span className="text-muted"> — </span>
        {state.meaning}
      </p>
      {state.example && <p className="text-xs italic text-muted">“{state.example}”</p>}
    </m.div>
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
