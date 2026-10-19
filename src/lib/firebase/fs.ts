/**
 * `firebase/firestore`, metered and reported. Every client module imports
 * Firestore from here (ESLint forbids the raw import outside `lib/firebase`)
 * so the Usage meter in More can count reads and writes this session, and so
 * a rejected write or a denied listener lands in More → Diagnostics as a
 * `[write]` / `[read]` line with the path and error code (a toast in dev).
 * Reads count only server-served snapshots (cache hits aren't billed).
 */
import * as F from "firebase/firestore";

import { noteFirebaseFailure } from "@/lib/diagLog";

export * from "firebase/firestore";

/** "messages/abc" from a reference or query; never the project id. */
function fsPath(target: unknown): string {
  const t = target as { path?: unknown; _query?: { path?: { canonicalString?: () => string } } } | null;
  if (t && typeof t.path === "string") return t.path;
  try {
    return t?._query?.path?.canonicalString?.() ?? "query";
  } catch {
    return "query";
  }
}

const usage = { reads: 0, writes: 0, startedAt: Date.now() };
const listeners = new Set<() => void>();
const bump = (kind: "reads" | "writes", n: number) => {
  if (n <= 0) return;
  usage[kind] += n;
  listeners.forEach((l) => l());
};
export const subscribeUsage = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const getUsage = () => usage;

function countSnapshot(snap: unknown) {
  const s = snap as { metadata?: { fromCache?: boolean }; docChanges?: () => unknown[]; exists?: () => boolean };
  if (s.metadata?.fromCache) return;
  if (typeof s.docChanges === "function") bump("reads", Math.max(1, s.docChanges().length));
  else bump("reads", 1);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const onSnapshot: typeof F.onSnapshot = ((...args: any[]) => {
  const i = args.findIndex((a, idx) => idx > 0 && typeof a === "function");
  if (i > 0) {
    const cb = args[i];
    args[i] = (snap: unknown) => {
      countSnapshot(snap);
      return cb(snap);
    };
    // A denied listener is reported even when the caller passed no error callback.
    const onError = typeof args[i + 1] === "function" ? args[i + 1] : null;
    args[i + 1] = (err: unknown) => {
      noteFirebaseFailure("read", "onSnapshot", fsPath(args[0]), err);
      onError?.(err);
    };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (F.onSnapshot as any)(...args);
}) as typeof F.onSnapshot;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getDoc: typeof F.getDoc = (async (ref: any) => {
  const snap = await reportRead("getDoc", ref, F.getDoc(ref));
  countSnapshot(snap);
  return snap;
}) as typeof F.getDoc;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getDocs: typeof F.getDocs = (async (q: any) => {
  const snap = await reportRead("getDocs", q, F.getDocs(q));
  if (!snap.metadata.fromCache) bump("reads", Math.max(1, snap.size));
  return snap;
}) as typeof F.getDocs;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getCountFromServer: typeof F.getCountFromServer = (async (q: any) => {
  bump("reads", 1);
  return F.getCountFromServer(q);
}) as typeof F.getCountFromServer;

const reportRead = <T>(op: string, target: unknown, p: Promise<T>): Promise<T> =>
  p.catch((err: unknown) => {
    noteFirebaseFailure("read", op, fsPath(target), err);
    throw err;
  });
const reportWrite = <T>(op: string, path: string, p: Promise<T>): Promise<T> =>
  p.catch((err: unknown) => {
    noteFirebaseFailure("write", op, path, err);
    throw err;
  });

const write = <T extends (...a: never[]) => unknown>(op: string, fn: T): T =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ((...args: any[]) => {
    bump("writes", 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return reportWrite(op, fsPath(args[0]), (fn as any)(...args));
  }) as unknown as T;

export const setDoc = write("setDoc", F.setDoc);
export const updateDoc = write("updateDoc", F.updateDoc);
export const addDoc = write("addDoc", F.addDoc);
export const deleteDoc = write("deleteDoc", F.deleteDoc);

export const writeBatch = ((db: F.Firestore) => {
  const batch = F.writeBatch(db);
  let ops = 0;
  const wrap = <K extends "set" | "update" | "delete">(k: K) => {
    const orig = (batch[k] as unknown as (...a: unknown[]) => F.WriteBatch).bind(batch);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (batch as any)[k] = (...a: unknown[]) => {
      ops++;
      return orig(...a);
    };
  };
  wrap("set");
  wrap("update");
  wrap("delete");
  const commit = batch.commit.bind(batch);
  batch.commit = () => {
    bump("writes", ops);
    return reportWrite("batch", `batch(${ops})`, commit());
  };
  return batch;
}) as typeof F.writeBatch;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const runTransaction: typeof F.runTransaction = (async (...args: any[]) => {
  bump("reads", 1);
  bump("writes", 1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return reportWrite("transaction", "transaction", (F.runTransaction as any)(...args));
}) as typeof F.runTransaction;
