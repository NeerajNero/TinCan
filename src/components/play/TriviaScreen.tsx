"use client";

import { AnimatePresence, m } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useFriendPresence } from "@/components/live/PresenceProvider";
import { SubHeader } from "@/components/memories/SubHeader";
import { Confetti } from "@/components/plan/Confetti";
import type { InviteSpec } from "@/components/play/InviteButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useNow } from "@/hooks/useNow";
import { usePair } from "@/hooks/usePair";
import { useStartInvite } from "@/hooks/useStartInvite";
import { cn } from "@/lib/cn";
import { recordGenericResult } from "@/lib/db/games";
import { advanceLive, answerLive, createRound, openLiveSession, recentRounds, submitAnswers, switchToAsync, triviaRef, type LiveStatus, type TriviaRoundDoc } from "@/lib/db/trivia";
import { onSnapshot } from "@/lib/firebase/fs";
import { notify } from "@/lib/notify";
import { errorMessage } from "@/lib/swallow";
import { pointsFor, QUESTION_MS, REVEAL_MS, ROUND_SIZE, shuffledOptions, totalScore, TRIVIA_BANK, type TriviaAnswer } from "@/lib/trivia";

const route = (id: string) => `/play/trivia/${id}`;
/** Live mode that hasn't produced a question by then offers async instead. */
const LIVE_GIVE_UP_MS = 10_000;
const inviteFor = (id: string, mode: "live" | "async"): InviteSpec => ({ activity: "trivia", route: route(id), label: mode === "live" ? "a live Trivia duel" : "a Trivia round", roundId: id });

function bankQuestion(id: number | undefined) {
  const q = id === undefined ? undefined : TRIVIA_BANK[id];
  if (q === undefined) throw new Error("trivia_question_missing");
  return q;
}

/* ── lobby ─────────────────────────────────────────────────────────────── */

export function TriviaLobby() {
  const { uid, me, friend, friendUid } = usePair();
  const router = useRouter();
  const startInvite = useStartInvite();
  const presence = useFriendPresence();
  const [rounds, setRounds] = useState<Array<TriviaRoundDoc & { id: string }> | null>(null);
  const [busy, setBusy] = useState(false);
  const online = presence?.online === true;
  const nameOf = (id: string) => (id === uid ? me.nickname : (friend?.nickname ?? "Friend"));

  useEffect(() => {
    void recentRounds().then(setRounds).catch(() => setRounds([]));
  }, []);

  async function start(mode: "live" | "async") {
    if (!friendUid || busy) return;
    setBusy(true);
    try {
      const id = await createRound(uid, [uid, friendUid], mode);
      const inv = inviteFor(id, mode);
      void startInvite(inv.activity, inv.route, inv.label, { roundId: id });
      router.push(route(id));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SubHeader help="trivia" emoji="🧠" title="Trivia duel" back="/play" screenName="Trivia duel" />
      <Card className="flex flex-col gap-3">
        <p className="text-sm text-muted">Ten questions, 15 seconds each. Right answers score 10, plus up to 5 for speed.</p>
        <div className="flex gap-2">
          <Button onClick={() => void start("live")} disabled={!friendUid || !online || busy} className="flex-1">
            Play live {online ? "⚡" : "(they're offline)"}
          </Button>
          <Button variant="soft" onClick={() => void start("async")} disabled={!friendUid || busy} className="flex-1">
            Play async
          </Button>
        </div>
      </Card>
      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-muted">Rounds</h2>
        {rounds === null && <p className="px-2 text-xs text-muted">Loading…</p>}
        {rounds?.length === 0 && <Card className="py-6 text-center text-sm text-muted">No rounds yet.</Card>}
        {rounds?.map((r) => {
          const mineDone = Boolean(r.answers?.[uid]);
          const theirsDone = Boolean(friendUid && r.answers?.[friendUid]);
          const label = mineDone && theirsDone ? `${r.scores[uid] ?? 0} – ${friendUid ? (r.scores[friendUid] ?? 0) : 0}` : mineDone ? `Waiting for ${nameOf(friendUid ?? "")}` : theirsDone ? "Your turn" : "Open";
          return (
            <button key={r.id} type="button" onClick={() => router.push(route(r.id))} className="card tap flex items-center gap-3 rounded-[20px] px-4 py-3 text-left">
              <span className="text-2xl" aria-hidden>
                {r.mode === "live" ? "⚡" : "🧠"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{r.mode === "live" ? "Live duel" : "Async round"}</span>
                <span className="block text-xs text-muted">started by {nameOf(r.createdBy)}</span>
              </span>
              <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", label === "Your turn" ? "bg-[var(--accent)] text-white" : "bg-surface-2")}>{label}</span>
            </button>
          );
        })}
      </section>
    </div>
  );
}

/* ── a round ───────────────────────────────────────────────────────────── */

export function TriviaRound({ id }: { id: string }) {
  const { uid, me, friend, friendUid } = usePair();
  const [round, setRound] = useState<(TriviaRoundDoc & { id: string }) | null | undefined>(undefined);
  const nameOf = useCallback((who: string) => (who === uid ? me.nickname : (friend?.nickname ?? "Friend")), [uid, me.nickname, friend?.nickname]);

  useEffect(() => {
    const unsub = onSnapshot(triviaRef(id), (snap) => setRound(snap.exists() ? { id, ...snap.data() } : null));
    return () => unsub();
  }, [id]);

  if (round === undefined) return <Card className="py-8 text-center text-muted">Loading round…</Card>;
  if (round === null) return <Card className="py-8 text-center text-muted">This round is gone.</Card>;

  const mineDone = Boolean(round.answers?.[uid]);
  const theirsDone = Boolean(friendUid && round.answers?.[friendUid]);

  return (
    <div className="flex flex-col gap-4">
      <SubHeader help="trivia" emoji={round.mode === "live" ? "⚡" : "🧠"} title={round.mode === "live" ? "Live duel" : "Trivia round"} back="/play/trivia" screenName="Trivia duel" invite={mineDone && theirsDone ? undefined : inviteFor(id, round.mode)} />
      {mineDone && theirsDone && <Results round={round} uid={uid} friendUid={friendUid} nameOf={nameOf} />}
      {mineDone && !theirsDone && (
        <Card className="flex flex-col items-center gap-2 py-8 text-center">
          <p className="font-heading text-3xl font-semibold">{round.scores[uid] ?? 0} pts</p>
          <p className="text-sm text-muted">Waiting for {friendUid ? nameOf(friendUid) : "them"} to play. You&apos;ll get a push when the scores are in.</p>
        </Card>
      )}
      {!mineDone && round.mode === "async" && <AsyncPlay round={round} uid={uid} friendUid={friendUid} theirsDone={theirsDone} />}
      {!mineDone && round.mode === "live" && <LivePlay round={round} uid={uid} friendUid={friendUid} theirsDone={theirsDone} />}
    </div>
  );
}

function Question({ round, index, onAnswer, deadline }: { round: TriviaRoundDoc; index: number; onAnswer: (choice: number, ms: number) => void; deadline: number }) {
  const q = bankQuestion(round.questionIds[index]);
  const { options, answer } = useMemo(() => shuffledOptions(q, round.seed), [q, round.seed]);
  const now = useNow(200);
  const [picked, setPicked] = useState<number | null>(null);
  const pickedRef = useRef<number | null>(null);
  const left = Math.max(0, deadline - now.getTime());
  const started = deadline - QUESTION_MS;

  // Time's up → a timeout answer, unless something was picked first.
  useEffect(() => {
    const t = setTimeout(() => {
      if (pickedRef.current !== null) return;
      pickedRef.current = -1;
      setPicked(-1);
      onAnswer(-1, QUESTION_MS);
    }, Math.max(0, deadline - Date.now()));
    return () => clearTimeout(t);
  }, [deadline, onAnswer]);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
        <span>
          {index + 1}/{ROUND_SIZE} · {q.category}
        </span>
        {picked === null ? <span className={cn("tabular-nums", left < 4000 && "text-red-500")}>{Math.ceil(left / 1000)}s</span> : <span>{picked === answer ? "✓ right" : picked === -1 ? "⏱️ time's up" : "✗ not quite"}</span>}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full bg-[var(--accent)] transition-[width] duration-200" style={{ width: `${picked === null ? (left / QUESTION_MS) * 100 : 0}%` }} />
      </div>
      <p className="font-heading text-lg font-semibold leading-snug">{q.q}</p>
      <div className="grid grid-cols-1 gap-2">
        {options.map((o, i) => (
          <button
            key={i}
            type="button"
            disabled={picked !== null}
            onClick={() => {
              pickedRef.current = i;
              setPicked(i);
              onAnswer(i, Date.now() - started);
            }}
            className={cn(
              "tap rounded-2xl px-4 py-3 text-left text-[15px] font-semibold",
              picked === null ? "bg-surface-2" : i === answer ? "bg-emerald-500 text-white" : picked === i ? "bg-red-500 text-white" : "bg-surface-2 opacity-50",
            )}
          >
            {o}
          </button>
        ))}
      </div>
      <AnimatePresence>
        {picked !== null && (
          <m.div key="reveal" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-surface-2 px-4 py-3">
            <p className="text-sm font-semibold">✓ {options[answer]}</p>
            <p className="mt-0.5 text-xs leading-snug text-muted">{q.explanation}</p>
          </m.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function useFinisher(round: TriviaRoundDoc & { id: string }, uid: string, friendUid: string | null, theirsDone: boolean) {
  return useCallback(
    async (answers: TriviaAnswer[]) => {
      await submitAnswers(round.id, uid, answers, theirsDone);
      const myScore = totalScore(answers);
      if (friendUid) {
        if (theirsDone) {
          const theirScore = round.scores[friendUid] ?? 0;
          const winnerId = myScore === theirScore ? null : myScore > theirScore ? uid : friendUid;
          await recordGenericResult("trivia", [uid, friendUid], winnerId, round.startedAt?.toMillis() ?? Date.now(), ROUND_SIZE, (w) => (w === uid ? "You" : "Friend"));
          void notify("yourTurn", { toUid: friendUid, body: `Trivia scores are in: ${myScore} – ${theirScore} 🧠`, data: { url: route(round.id) } });
        } else {
          void notify("yourTurn", { toUid: friendUid, body: `finished the trivia round with ${myScore} pts — your go 🧠`, data: { url: route(round.id) } });
        }
      }
    },
    [round, uid, friendUid, theirsDone],
  );
}

function AsyncPlay({ round, uid, friendUid, theirsDone }: { round: TriviaRoundDoc & { id: string }; uid: string; friendUid: string | null; theirsDone: boolean }) {
  const [index, setIndex] = useState<number | null>(null);
  const [deadline, setDeadline] = useState(0);
  const answers = useRef<TriviaAnswer[]>([]);
  const finish = useFinisher(round, uid, friendUid, theirsDone);
  const [saving, setSaving] = useState(false);

  const onAnswer = useCallback(
    (choice: number, ms: number) => {
      if (index === null) return;
      const q = bankQuestion(round.questionIds[index]);
      const { answer } = shuffledOptions(q, round.seed);
      answers.current[index] = { choice, ms, correct: choice === answer };
      // The answer and its explanation stay up for REVEAL_MS before the next question.
      setTimeout(() => {
        if (index + 1 >= ROUND_SIZE) {
          setSaving(true);
          void finish(answers.current).finally(() => setSaving(false));
          setIndex(null);
        } else {
          setIndex(index + 1);
          setDeadline(Date.now() + QUESTION_MS);
        }
      }, REVEAL_MS);
    },
    [index, round, finish],
  );

  if (saving) return <Card className="py-8 text-center text-muted">Saving your score…</Card>;
  if (index === null) {
    return (
      <Card className="flex flex-col items-center gap-3 py-8 text-center">
        <span className="text-5xl" aria-hidden>
          🧠
        </span>
        <p className="text-sm text-muted">{ROUND_SIZE} questions, 15 seconds each. The timer starts when you tap.</p>
        <Button
          onClick={() => {
            answers.current = [];
            setIndex(0);
            setDeadline(Date.now() + QUESTION_MS);
          }}
          className="px-6"
        >
          Start
        </Button>
      </Card>
    );
  }
  return <Question key={index} round={round} index={index} deadline={deadline} onAnswer={onAnswer} />;
}

function LivePlay({ round, uid, friendUid, theirsDone }: { round: TriviaRoundDoc & { id: string }; uid: string; friendUid: string | null; theirsDone: boolean }) {
  const { friend } = usePair();
  const [status, setStatus] = useState<LiveStatus>({ phase: "connecting" });
  const [openedAt] = useState(() => Date.now());
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const answers = useRef<TriviaAnswer[]>([]);
  const finish = useFinisher(round, uid, friendUid, theirsDone);
  const now = useNow(250);
  const submitted = useRef(false);
  const friendName = friend?.nickname ?? "them";

  // Auto-join: opening the round as either player enters the live session (phase 21).
  useEffect(() => openLiveSession(round.id, uid, round.players, setStatus), [round.id, uid, round.players]);

  const cursor = status.phase === "playing" ? status.cursor : null;
  const qIndex = status.phase === "playing" ? status.qIndex : -1;
  const qStartedAt = cursor?.qStartedAt ?? 0;
  const deadline = qStartedAt + QUESTION_MS;
  const bothAnswered = Boolean(cursor?.answered && friendUid && cursor.answered[uid] !== undefined && cursor.answered[friendUid] !== undefined);
  const timedOut = cursor ? now.getTime() > deadline + 800 : false;
  const countdownLeft = Math.max(0, qStartedAt - now.getTime());
  const stale = status.phase !== "playing" && now.getTime() - openedAt >= LIVE_GIVE_UP_MS;

  // Advance in lockstep after the reveal has been on screen: whoever notices first wins the transaction.
  useEffect(() => {
    if (!cursor || qIndex < 0 || qIndex >= ROUND_SIZE) return;
    if (!bothAnswered && !timedOut) return;
    const t = setTimeout(() => void advanceLive(round.id, qIndex, ROUND_SIZE), REVEAL_MS);
    return () => clearTimeout(t);
  }, [cursor, qIndex, bothAnswered, timedOut, round.id]);

  // Round over → submit mine once.
  useEffect(() => {
    if (qIndex >= ROUND_SIZE && !submitted.current) {
      submitted.current = true;
      while (answers.current.length < ROUND_SIZE) answers.current.push({ choice: -1, ms: QUESTION_MS, correct: false });
      void finish(answers.current.slice(0, ROUND_SIZE));
    }
  }, [qIndex, finish]);

  const onAnswer = useCallback(
    (choice: number, ms: number) => {
      const q = bankQuestion(round.questionIds[qIndex]);
      const { answer } = shuffledOptions(q, round.seed);
      answers.current[qIndex] = { choice, ms, correct: choice === answer };
      void answerLive(round.id, uid, choice);
    },
    [qIndex, round, uid],
  );

  async function playAsync() {
    setSwitching(true);
    setSwitchError(null);
    try {
      await switchToAsync(round.id);
    } catch (err) {
      setSwitchError(errorMessage(err, "Couldn't switch — try again"));
      setSwitching(false);
    }
  }
  const asyncButton = (
    <Button variant="soft" onClick={() => void playAsync()} disabled={switching} className="px-5">
      {switching ? "Switching…" : "Play async instead"}
    </Button>
  );

  if (status.phase === "error" || (status.phase === "connecting" && stale)) {
    return (
      <Card className="flex flex-col items-center gap-3 py-8 text-center">
        <span className="text-5xl" aria-hidden>
          📡
        </span>
        <p className="font-semibold">Couldn&apos;t connect</p>
        <p className="text-sm text-muted">{status.phase === "error" ? `Live mode was refused (${status.code}). ` : "Live mode didn't start. "}You can still play this round async — each at your own pace.</p>
        {asyncButton}
        {switchError && <p className="text-xs text-red-500">{switchError}</p>}
      </Card>
    );
  }
  if (status.phase === "connecting") return <Card className="py-8 text-center text-muted">Connecting…</Card>;
  if (status.phase === "waiting") {
    const theyJoined = Boolean(friendUid && typeof status.cursor.joined?.[friendUid] === "number");
    return (
      <Card className="flex flex-col items-center gap-3 py-8 text-center">
        <span className="text-5xl" aria-hidden>
          ⚡
        </span>
        <p className="font-semibold">You&apos;re in</p>
        <p className="text-sm text-muted">{theyJoined ? "Both here — starting…" : `Waiting for ${friendName} to join. They got a push; it starts the moment they open this round.`}</p>
        {stale && !theyJoined && asyncButton}
        {switchError && <p className="text-xs text-red-500">{switchError}</p>}
      </Card>
    );
  }
  if (qIndex >= ROUND_SIZE) return <Card className="py-8 text-center text-muted">Tallying…</Card>;
  if (countdownLeft > 0) {
    return (
      <Card className="flex flex-col items-center gap-2 py-10 text-center">
        <p className="text-sm font-bold uppercase tracking-wide text-muted">Both here — get ready</p>
        <m.p key={Math.ceil(countdownLeft / 1000)} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-heading text-6xl font-semibold tabular-nums">
          {Math.ceil(countdownLeft / 1000)}
        </m.p>
      </Card>
    );
  }
  return (
    <>
      <Question key={qIndex} round={round} index={qIndex} deadline={deadline} onAnswer={onAnswer} />
      {cursor?.answered?.[uid] !== undefined && !bothAnswered && <p className="text-center text-xs text-muted">Waiting for {friendName}…</p>}
    </>
  );
}

function Results({ round, uid, friendUid, nameOf }: { round: TriviaRoundDoc; uid: string; friendUid: string | null; nameOf: (u: string) => string }) {
  const mine = round.scores[uid] ?? 0;
  const theirs = friendUid ? (round.scores[friendUid] ?? 0) : 0;
  const [burst, setBurst] = useState(0);
  const fired = useRef(false);
  useEffect(() => {
    if (mine > theirs && !fired.current) {
      fired.current = true;
      setBurst(1);
    }
  }, [mine, theirs]);
  const myAnswers = round.answers[uid] ?? [];
  const theirAnswers = friendUid ? (round.answers[friendUid] ?? []) : [];
  return (
    <>
      <Card className="flex flex-col items-center gap-2 text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">{mine === theirs ? "It's a tie" : mine > theirs ? "You won 🎉" : `${friendUid ? nameOf(friendUid) : "They"} won`}</p>
        <p className="font-heading text-4xl font-semibold tabular-nums">
          {mine} <span className="text-muted">–</span> {theirs}
        </p>
        <p className="text-xs text-muted">
          {nameOf(uid)} vs {friendUid ? nameOf(friendUid) : "friend"}
        </p>
      </Card>
      <Card className="flex flex-col gap-2">
        {round.questionIds.map((qid, i) => {
          const q = bankQuestion(qid);
          const { options, answer } = shuffledOptions(q, round.seed);
          const a = myAnswers[i];
          const b = theirAnswers[i];
          return (
            <div key={qid} className="flex flex-col gap-0.5 border-b border-border pb-2 last:border-0">
              <p className="text-sm font-semibold">{q.q}</p>
              <p className="text-xs text-muted">✓ {options[answer]}</p>
              <p className="text-[11px] leading-snug text-muted">{q.explanation}</p>
              <div className="flex gap-3 text-xs">
                <AnimatePresence>
                  <m.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cn(a?.correct ? "text-emerald-600 dark:text-emerald-300" : "text-red-500")}>
                    You: {a ? (a.choice === -1 ? "⏱️" : options[a.choice]) : "—"} {a ? `(+${pointsFor(a)})` : ""}
                  </m.span>
                </AnimatePresence>
                <span className={cn(b?.correct ? "text-emerald-600 dark:text-emerald-300" : "text-red-500")}>
                  Them: {b ? (b.choice === -1 ? "⏱️" : options[b.choice]) : "—"} {b ? `(+${pointsFor(b)})` : ""}
                </span>
              </div>
            </div>
          );
        })}
      </Card>
      <Confetti burst={burst} />
    </>
  );
}
