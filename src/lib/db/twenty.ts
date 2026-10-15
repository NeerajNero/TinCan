/** 20 Questions at RTDB twenty/main — one round at a time between the two of you. */
import { onValue, ref, update } from "firebase/database";

import secrets from "@/content/twenty-secrets.json";
import { getRtdb } from "@/lib/firebase/client";

export type TwentyStatus = "setup" | "asking" | "done";
export type TwentyAnswer = "yes" | "no" | "sortof";

export interface TwentyQuestion {
  q: string;
  a: TwentyAnswer | null;
}

export interface TwentyNode {
  holderUid: string;
  guesserUid: string;
  secret: string;
  status: TwentyStatus;
  /** JSON-encoded TwentyQuestion[] (RTDB arrays are unreliable). */
  questions: string;
  finalGuess: string | null;
  /** true when the guesser got it. */
  won: boolean | null;
  startedAt: number;
  updatedAt: number;
}

export const MAX_QUESTIONS = 20;
const nodeRef = () => ref(getRtdb(), "twenty/main");

export function subscribeTwenty(cb: (node: TwentyNode | null) => void): () => void {
  return onValue(nodeRef(), (snap) => cb(snap.exists() ? (snap.val() as TwentyNode) : null));
}

export const parseQuestions = (node: TwentyNode | null): TwentyQuestion[] => {
  try {
    return node?.questions ? (JSON.parse(node.questions) as TwentyQuestion[]) : [];
  } catch {
    return [];
  }
};

export const randomSecret = () => secrets[Math.floor(Math.random() * secrets.length)];

/** Holder picks a secret and the round begins. */
export function startRound(holderUid: string, guesserUid: string, secret: string): Promise<void> {
  const now = Date.now();
  const node: TwentyNode = { holderUid, guesserUid, secret: secret.trim().slice(0, 60), status: "asking", questions: "[]", finalGuess: null, won: null, startedAt: now, updatedAt: now };
  return update(nodeRef(), node);
}

export function askQuestion(node: TwentyNode, q: string): Promise<void> {
  const list = parseQuestions(node);
  if (list.length >= MAX_QUESTIONS) return Promise.resolve();
  list.push({ q: q.trim().slice(0, 140), a: null });
  return update(nodeRef(), { questions: JSON.stringify(list), updatedAt: Date.now() });
}

export function answerQuestion(node: TwentyNode, a: TwentyAnswer): Promise<void> {
  const list = parseQuestions(node);
  const last = list[list.length - 1];
  if (!last || last.a) return Promise.resolve();
  last.a = a;
  return update(nodeRef(), { questions: JSON.stringify(list), updatedAt: Date.now() });
}

export function finalGuess(node: TwentyNode, guess: string): Promise<void> {
  const won = guess.trim().toLowerCase() === node.secret.trim().toLowerCase();
  return update(nodeRef(), { finalGuess: guess.trim().slice(0, 60), won, status: "done", updatedAt: Date.now() });
}

/** Holder can also judge a near-miss as correct. */
export function judgeGuess(won: boolean): Promise<void> {
  return update(nodeRef(), { won, status: "done", updatedAt: Date.now() });
}

export function clearRound(): Promise<void> {
  return update(nodeRef(), { status: "setup", secret: "", questions: "[]", finalGuess: null, won: null, updatedAt: Date.now() });
}
