/**
 * `firebase/firestore`, metered. Every client module imports Firestore from
 * here so the Usage meter in More can count reads and writes this session.
 * Reads count only server-served snapshots (cache hits aren't billed).
 */
import * as F from "firebase/firestore";

export * from "firebase/firestore";

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
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (F.onSnapshot as any)(...args);
}) as typeof F.onSnapshot;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getDoc: typeof F.getDoc = (async (ref: any) => {
  const snap = await F.getDoc(ref);
  countSnapshot(snap);
  return snap;
}) as typeof F.getDoc;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getDocs: typeof F.getDocs = (async (q: any) => {
  const snap = await F.getDocs(q);
  if (!snap.metadata.fromCache) bump("reads", Math.max(1, snap.size));
  return snap;
}) as typeof F.getDocs;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getCountFromServer: typeof F.getCountFromServer = (async (q: any) => {
  bump("reads", 1);
  return F.getCountFromServer(q);
}) as typeof F.getCountFromServer;

const write = <T extends (...a: never[]) => unknown>(fn: T): T =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ((...args: any[]) => {
    bump("writes", 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (fn as any)(...args);
  }) as T;

export const setDoc = write(F.setDoc);
export const updateDoc = write(F.updateDoc);
export const addDoc = write(F.addDoc);
export const deleteDoc = write(F.deleteDoc);

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
    return commit();
  };
  return batch;
}) as typeof F.writeBatch;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const runTransaction: typeof F.runTransaction = (async (...args: any[]) => {
  bump("reads", 1);
  bump("writes", 1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (F.runTransaction as any)(...args);
}) as typeof F.runTransaction;
