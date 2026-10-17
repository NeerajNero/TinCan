"use client";

import { useEffect, useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { usePair } from "@/hooks/usePair";
import { createSystemMessage } from "@/lib/chat/system";
import { cn } from "@/lib/cn";
import { answerQuestion, askQuestion, clearRound, finalGuess, judgeGuess, MAX_QUESTIONS, parseQuestions, randomSecret, startRound, subscribeTwenty, type TwentyAnswer, type TwentyNode } from "@/lib/db/twenty";
import { notify } from "@/lib/notify";
import { swallow } from "@/lib/swallow";

const ROUTE = "/play/twenty";

export function TwentyScreen() {
  const { uid, me, friend, friendUid } = usePair();
  const [node, setNode] = useState<TwentyNode | null | undefined>(undefined);
  const [secret, setSecret] = useState("");
  const [text, setText] = useState("");
  const friendName = friend?.nickname ?? "your friend";
  const nameOf = (id: string) => (id === uid ? me.nickname : friendName);

  useEffect(() => {
    const unsub = subscribeTwenty(setNode);
    return () => unsub();
  }, []);

  const questions = parseQuestions(node ?? null);
  const active = node && node.status === "asking";
  const holder = node?.holderUid === uid;
  const pending = questions[questions.length - 1]?.a === null;
  const asked = questions.length;
  const myMove = active && (holder ? pending : !pending && asked < MAX_QUESTIONS);

  async function begin(s: string) {
    if (!friendUid || !s.trim()) return;
    await startRound(uid, friendUid, s);
    setSecret("");
    void notify("yourTurn", { toUid: friendUid, body: "20 Questions: I've picked a secret, start guessing 🔍", data: { url: ROUTE } });
  }

  async function ask() {
    if (!node || !friendUid || !text.trim()) return;
    await askQuestion(node, text);
    setText("");
    void notify("yourTurn", { toUid: node.holderUid, body: `20 Questions: "${text.trim().slice(0, 60)}"`, data: { url: ROUTE } });
  }

  async function answer(a: TwentyAnswer) {
    if (!node) return;
    await answerQuestion(node, a);
    void notify("yourTurn", { toUid: node.guesserUid, body: `20 Questions: ${a === "sortof" ? "sort of" : a}`, data: { url: ROUTE } });
  }

  async function guess() {
    if (!node || !text.trim()) return;
    const g = text.trim();
    await finalGuess(node, g);
    setText("");
    const won = g.toLowerCase() === node.secret.toLowerCase();
    createSystemMessage("twenty-result", won ? `🔍 ${nameOf(node.guesserUid)} guessed "${node.secret}" in ${asked} questions!` : `🔍 ${nameOf(node.guesserUid)} guessed "${g}" — it was "${node.secret}"`, { won: won ? 1 : 0 }).catch(swallow);
    void notify("yourTurn", { toUid: node.holderUid, body: `20 Questions: final guess "${g}"`, data: { url: ROUTE } });
  }

  return (
    <div className="flex flex-col gap-4">
      <SubHeader help="twenty" emoji="🔍" title="20 Questions" back="/play" screenName="20 Questions" />

      {node === undefined && <Card className="py-8 text-center text-muted">Loading…</Card>}

      {(node === null || node?.status === "setup") && (
        <Card className="flex flex-col gap-3">
          <p className="text-sm text-muted">Pick a secret for {friendName} to guess with yes / no questions.</p>
          <div className="flex gap-2">
            <Input value={secret} onChange={(e) => setSecret(e.target.value.slice(0, 60))} placeholder="A thing, e.g. umbrella" aria-label="Secret" />
            <Button variant="soft" onClick={() => setSecret(randomSecret() ?? "")} className="shrink-0 px-3">
              Random
            </Button>
          </div>
          <Button onClick={() => void begin(secret)} disabled={!secret.trim() || !friendUid} className="self-end px-5">
            Start
          </Button>
        </Card>
      )}

      {node && node.status !== "setup" && (
        <>
          <Card className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden>
              {holder ? "🤫" : "🧐"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{holder ? `You know the secret: ${node.secret}` : `${nameOf(node.holderUid)} has a secret`}</p>
              <p className="text-xs text-muted">
                {asked}/{MAX_QUESTIONS} questions · {node.status === "done" ? "finished" : myMove ? "your move" : `${nameOf(holder ? node.guesserUid : node.holderUid)}'s move`}
              </p>
            </div>
            <span className="font-heading text-2xl font-semibold tabular-nums">{MAX_QUESTIONS - asked}</span>
          </Card>

          <Card className="flex max-h-[45dvh] flex-col gap-2 overflow-y-auto">
            {questions.length === 0 && <p className="text-center text-sm text-muted">No questions yet.</p>}
            {questions.map((q, i) => (
              <div key={i} className="flex flex-col gap-1">
                <p className="self-end rounded-2xl rounded-br-md bg-accent-soft px-3 py-1.5 text-sm">
                  <span className="mr-1 text-[10px] font-bold text-muted">{i + 1}</span>
                  {q.q}
                </p>
                {q.a && (
                  <p className={cn("self-start rounded-2xl rounded-bl-md px-3 py-1.5 text-sm font-bold", q.a === "yes" ? "bg-emerald-400/25" : q.a === "no" ? "bg-red-400/20" : "bg-amber-400/25")}>
                    {q.a === "sortof" ? "Sort of" : q.a === "yes" ? "Yes" : "No"}
                  </p>
                )}
              </div>
            ))}
            {node.finalGuess && (
              <p className="mt-1 text-center text-sm">
                Final guess: <strong>{node.finalGuess}</strong> — {node.won ? "correct! 🎉" : `nope, it was "${node.secret}"`}
              </p>
            )}
          </Card>

          {active && holder && pending && (
            <div className="flex gap-2">
              <Button onClick={() => void answer("yes")} className="flex-1 bg-emerald-500 text-white">Yes</Button>
              <Button onClick={() => void answer("sortof")} className="flex-1 bg-amber-500 text-white">Sort of</Button>
              <Button onClick={() => void answer("no")} className="flex-1 bg-red-500 text-white">No</Button>
            </div>
          )}
          {active && holder && !pending && <p className="text-center text-sm text-muted">Waiting for a question…</p>}

          {active && !holder && !pending && (
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void ask();
              }}
            >
              <div className="flex gap-2">
                <Input value={text} onChange={(e) => setText(e.target.value.slice(0, 140))} placeholder={asked < MAX_QUESTIONS ? "Is it bigger than a cat?" : "Out of questions — guess!"} aria-label="Question" />
                <Button type="submit" disabled={!text.trim() || asked >= MAX_QUESTIONS} className="shrink-0 px-4">
                  Ask
                </Button>
              </div>
              <Button variant="soft" onClick={() => void guess()} disabled={!text.trim()} className="self-end px-4 py-2 text-sm">
                Use this as my final guess
              </Button>
            </form>
          )}
          {active && !holder && pending && <p className="text-center text-sm text-muted">Waiting for {nameOf(node.holderUid)} to answer…</p>}

          {node.status === "done" && (
            <Card className="flex flex-col items-center gap-2 text-center">
              {holder && !node.won && node.finalGuess && (
                <Button variant="soft" onClick={() => void judgeGuess(true)} className="text-sm">
                  Close enough — give it to them
                </Button>
              )}
              <Button onClick={() => void clearRound()}>New round</Button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
