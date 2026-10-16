"use client";

import { m } from "framer-motion";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { Confetti } from "@/components/plan/Confetti";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { usePair } from "@/hooks/usePair";
import { cn } from "@/lib/cn";
import { createQuiz, deleteQuiz, MAX_QUIZ_QUESTIONS, MIN_QUESTIONS, quizzesCol, recentQuizzes, submitQuiz, updateQuiz, type QuizDoc, type QuizQuestion } from "@/lib/db/quizzes";
import { onSnapshot, type QueryDocumentSnapshot } from "@/lib/firebase/fs";
import { doc, onSnapshot as onDoc } from "@/lib/firebase/fs";
import { recordTogetherEvent } from "@/lib/garden";
import { notify } from "@/lib/notify";
import { seededOrder } from "@/lib/seeded";

interface Quiz extends QuizDoc {
  id: string;
}
const mapDoc = (d: QueryDocumentSnapshot<QuizDoc>): Quiz => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) });
const blankQ = (): QuizQuestion => ({ q: "", answer: "", decoys: ["", "", ""] });

/* ── list ──────────────────────────────────────────────────────────────── */

export function QuizList() {
  const { uid, me, friend, friendUid } = usePair();
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [ready, setReady] = useState(false);
  const nameOf = (id: string) => (id === uid ? me.nickname : (friend?.nickname ?? "Friend"));

  useEffect(() => {
    const unsub = onSnapshot(recentQuizzes(), (snap) => {
      setQuizzes(snap.docs.map(mapDoc));
      setReady(true);
    });
    return () => unsub();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <SubHeader
        emoji="🪞"
        title="Know-me quiz"
        back="/play"
        screenName="Know-me quiz"
        action={
          <Button onClick={() => router.push("/play/quiz/new")} className="px-4 py-2 text-sm">
            Write one
          </Button>
        }
      />
      <p className="-mt-2 px-2 text-xs text-muted">Write 5–10 questions about yourself. {friend?.nickname ?? "They"} answers, you both see the score.</p>
      {!ready && <ListSkeleton />}
      {ready && quizzes.length === 0 && <Card className="py-8 text-center text-muted">No quizzes yet. Write the first one?</Card>}
      {quizzes.map((q) => {
        const mine = q.authorId === uid;
        const taken = friendUid ? q.takenBy?.[mine ? friendUid : uid] : undefined;
        const status = q.status === "draft" ? "Draft" : taken ? `${taken.score}/${q.questions.length}` : mine ? "Waiting" : "New";
        return (
          <button key={q.id} type="button" onClick={() => router.push(`/play/quiz/${q.id}`)} className="card tap flex items-center gap-3 rounded-[20px] px-4 py-3 text-left">
            <span className="text-2xl" aria-hidden>
              🪞
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{q.title || `About ${nameOf(q.authorId)}`}</span>
              <span className="block text-xs text-muted">
                by {nameOf(q.authorId)} · {q.questions.length} questions
              </span>
            </span>
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", status === "New" ? "bg-[var(--accent)] text-white" : "bg-surface-2")}>{status}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── author / take ─────────────────────────────────────────────────────── */

export function QuizDetail({ id }: { id: string }) {
  const { uid, me, friend, friendUid } = usePair();
  const [quiz, setQuiz] = useState<Quiz | null | undefined>(id === "new" ? null : undefined);
  const nameOf = (who: string) => (who === uid ? me.nickname : (friend?.nickname ?? "Friend"));

  useEffect(() => {
    if (id === "new") return;
    const unsub = onDoc(doc(quizzesCol(), id), (snap) => setQuiz(snap.exists() ? { id: snap.id, ...snap.data() } : null));
    return () => unsub();
  }, [id]);

  if (quiz === undefined) return <Card className="py-8 text-center text-muted">Loading…</Card>;
  if (id === "new") return <QuizEditor uid={uid} friendUid={friendUid} quiz={null} />;
  if (quiz === null) return <Card className="py-8 text-center text-muted">This quiz is gone.</Card>;
  if (quiz.authorId === uid) return <AuthorView quiz={quiz} uid={uid} friendUid={friendUid} nameOf={nameOf} />;
  return <TakeQuiz quiz={quiz} uid={uid} nameOf={nameOf} />;
}

function AuthorView({ quiz, uid, friendUid, nameOf }: { quiz: Quiz; uid: string; friendUid: string | null; nameOf: (u: string) => string }) {
  const [editing, setEditing] = useState(quiz.status === "draft");
  const taken = friendUid ? quiz.takenBy?.[friendUid] : undefined;
  if (editing) return <QuizEditor uid={uid} friendUid={friendUid} quiz={quiz} onDone={() => setEditing(false)} />;
  return (
    <div className="flex flex-col gap-4">
      <SubHeader emoji="🪞" title={quiz.title || "Your quiz"} back="/play/quiz" screenName="Know-me quiz" />
      <Card className="flex flex-col items-center gap-2 text-center">
        {taken ? (
          <>
            <p className="text-xs font-bold uppercase tracking-wide text-muted">{friendUid ? nameOf(friendUid) : "They"} scored</p>
            <p className="font-heading text-4xl font-semibold">
              {taken.score}/{quiz.questions.length}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">Published. Waiting for {friendUid ? nameOf(friendUid) : "them"} to take it.</p>
        )}
      </Card>
      <Card className="flex flex-col gap-2">
        {quiz.questions.map((q, i) => (
          <div key={i} className="border-b border-border pb-2 text-sm last:border-0">
            <p className="font-semibold">{q.q}</p>
            <p className="text-xs text-muted">✓ {q.answer}{taken ? ` · they said: ${[q.answer, ...q.decoys][taken.answers[i] ?? -1] ?? "—"}` : ""}</p>
          </div>
        ))}
      </Card>
      <div className="flex justify-end gap-2">
        {!taken && (
          <Button variant="soft" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
        <Button variant="ghost" onClick={() => void deleteQuiz(quiz.id).then(() => history.back())} className="text-red-500">
          <Trash2 size={16} /> Delete
        </Button>
      </div>
    </div>
  );
}

function QuizEditor({ uid, friendUid, quiz, onDone }: { uid: string; friendUid: string | null; quiz: Quiz | null; onDone?: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(quiz?.title ?? "");
  const [questions, setQuestions] = useState<QuizQuestion[]>(quiz?.questions.length ? quiz.questions : Array.from({ length: MIN_QUESTIONS }, blankQ));
  const [busy, setBusy] = useState(false);
  const complete = questions.filter((q) => q.q.trim() && q.answer.trim() && q.decoys.every((d) => d.trim()));
  const canPublish = complete.length >= MIN_QUESTIONS && complete.length === questions.length && !busy;

  function patch(i: number, changes: Partial<QuizQuestion>) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...changes } : q)));
  }

  async function save(publish: boolean) {
    setBusy(true);
    try {
      let id = quiz?.id;
      if (id) await updateQuiz(id, title, questions, publish);
      else id = await createQuiz(uid, title, questions, publish);
      if (publish && friendUid) void notify("invite", { toUid: friendUid, body: "made a know-me quiz for you 🪞", data: { url: `/play/quiz/${id}` } });
      if (onDone) onDone();
      else router.replace(`/play/quiz/${id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SubHeader emoji="🪞" title={quiz ? "Edit quiz" : "New quiz"} back="/play/quiz" screenName="Know-me quiz" />
      <Card className="flex flex-col gap-2">
        <Label htmlFor="quiz-title">Title (optional)</Label>
        <Input id="quiz-title" value={title} onChange={(e) => setTitle(e.target.value.slice(0, 60))} placeholder="How well do you know me?" />
      </Card>
      {questions.map((q, i) => (
        <Card key={i} className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Question {i + 1}</p>
            {questions.length > MIN_QUESTIONS && (
              <button type="button" onClick={() => setQuestions((qs) => qs.filter((_, idx) => idx !== i))} aria-label="Remove question" className="tap grid size-9 place-items-center rounded-full text-muted">
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <Input value={q.q} onChange={(e) => patch(i, { q: e.target.value.slice(0, 160) })} placeholder="What's my comfort food?" aria-label="Question" />
          <Input value={q.answer} onChange={(e) => patch(i, { answer: e.target.value.slice(0, 80) })} placeholder="Right answer" aria-label="Right answer" className="border-emerald-400/60" />
          {q.decoys.map((d, j) => (
            <Input key={j} value={d} onChange={(e) => patch(i, { decoys: q.decoys.map((x, k) => (k === j ? e.target.value.slice(0, 80) : x)) })} placeholder={`Decoy ${j + 1}`} aria-label={`Decoy ${j + 1}`} />
          ))}
        </Card>
      ))}
      {questions.length < MAX_QUIZ_QUESTIONS && (
        <Button variant="soft" onClick={() => setQuestions((qs) => [...qs, blankQ()])} className="self-center">
          Add a question
        </Button>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => void save(false)} disabled={busy}>
          Save draft
        </Button>
        <Button onClick={() => void save(true)} disabled={!canPublish} className="px-5">
          {busy ? "Saving…" : "Publish"}
        </Button>
      </div>
      {!canPublish && <p className="text-center text-xs text-muted">Fill every question, answer and all three decoys (at least {MIN_QUESTIONS}).</p>}
    </div>
  );
}

function TakeQuiz({ quiz, uid, nameOf }: { quiz: Quiz; uid: string; nameOf: (u: string) => string }) {
  const taken = quiz.takenBy?.[uid];
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [burst, setBurst] = useState(0);
  const options = useMemo(() => {
    const q = quiz.questions[index];
    if (!q) return [];
    const all = [q.answer, ...q.decoys];
    return seededOrder(all.length, index * 31 + quiz.questions.length).map((i) => ({ text: all[i], original: i }));
  }, [quiz.questions, index]);

  if (quiz.status === "draft") return <Card className="py-8 text-center text-muted">{nameOf(quiz.authorId)} is still writing this one.</Card>;

  if (taken) {
    return (
      <div className="flex flex-col gap-4">
        <SubHeader emoji="🪞" title={quiz.title || `About ${nameOf(quiz.authorId)}`} back="/play/quiz" />
        <Card className="flex flex-col items-center gap-2 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">You scored</p>
          <p className="font-heading text-4xl font-semibold">
            {taken.score}/{quiz.questions.length}
          </p>
        </Card>
        <Card className="flex flex-col gap-2">
          {quiz.questions.map((q, i) => {
            const mine = [q.answer, ...q.decoys][taken.answers[i] ?? -1];
            return (
              <div key={i} className="border-b border-border pb-2 text-sm last:border-0">
                <p className="font-semibold">{q.q}</p>
                <p className={cn("text-xs", taken.answers[i] === 0 ? "text-emerald-600 dark:text-emerald-300" : "text-red-500")}>
                  You: {mine ?? "—"}
                  {taken.answers[i] !== 0 && ` · right: ${q.answer}`}
                </p>
              </div>
            );
          })}
        </Card>
      </div>
    );
  }

  const q = quiz.questions[index];
  const done = index >= quiz.questions.length;

  async function next() {
    if (picked === null) return;
    const nextAnswers = [...answers, picked];
    setAnswers(nextAnswers);
    setPicked(null);
    if (index + 1 >= quiz.questions.length) {
      const score = nextAnswers.filter((a) => a === 0).length;
      if (score === quiz.questions.length) setBurst(1);
      await submitQuiz(quiz.id, uid, nextAnswers, score);
      void recordTogetherEvent("quiz", uid);
      void notify("yourTurn", { toUid: quiz.authorId, body: `took your quiz and scored ${score}/${quiz.questions.length} 🪞`, data: { url: `/play/quiz/${quiz.id}` } });
    }
    setIndex(index + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      <SubHeader emoji="🪞" title={quiz.title || `About ${nameOf(quiz.authorId)}`} back="/play/quiz" />
      {!done && q && (
        <Card className="flex flex-col gap-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            {index + 1}/{quiz.questions.length}
          </p>
          <p className="font-heading text-lg font-semibold leading-snug">{q.q}</p>
          <div className="flex flex-col gap-2">
            {options.map((o) => {
              const chosen = picked === o.original;
              const reveal = picked !== null;
              return (
                <m.button
                  key={o.original}
                  type="button"
                  disabled={reveal}
                  onClick={() => setPicked(o.original)}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "tap rounded-2xl px-4 py-3 text-left text-[15px] font-semibold",
                    !reveal && "bg-surface-2",
                    reveal && o.original === 0 && "bg-emerald-400/30",
                    reveal && chosen && o.original !== 0 && "bg-red-400/30",
                    reveal && !chosen && o.original !== 0 && "bg-surface-2 opacity-50",
                  )}
                >
                  {o.text}
                </m.button>
              );
            })}
          </div>
          {picked !== null && (
            <Button onClick={() => void next()} className="self-end px-5">
              {index + 1 >= quiz.questions.length ? "See score" : "Next"}
            </Button>
          )}
        </Card>
      )}
      {done && <Card className="py-8 text-center text-muted">Saving your score…</Card>}
      <Confetti burst={burst} />
    </div>
  );
}
