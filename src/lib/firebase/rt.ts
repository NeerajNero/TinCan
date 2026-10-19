/**
 * `firebase/database`, with every failure reported. Client code imports the
 * RTDB SDK from here (ESLint forbids the raw import outside `lib/firebase`):
 * a rejected set / update / remove / push / transaction / onDisconnect, or a
 * listener the rules refuse, lands in More → Diagnostics as a `[write]` or
 * `[read]` line with the path and error code, and in development as a toast.
 * Until phase 21 a denied `onValue` with no error callback simply never
 * fired, which is how the live trivia duel sat on "Connecting…" forever.
 */
import * as D from "firebase/database";

import { noteFirebaseFailure } from "@/lib/diagLog";

export * from "firebase/database";

/** "games/abc" from a reference or query; never the database host. */
export function rtdbPath(target: unknown): string {
  try {
    const t = target as { ref?: { toString(): string }; toString(): string };
    const url = (t.ref ?? t).toString();
    return decodeURIComponent(url.replace(/^[a-z]+:\/\/[^/]+\/?/i, "")) || "/";
  } catch {
    return "?";
  }
}

const reportWrite = <T>(op: string, target: unknown, p: Promise<T>): Promise<T> =>
  p.catch((err: unknown) => {
    noteFirebaseFailure("write", op, rtdbPath(target), err);
    throw err;
  });

// The SDK's own types carry compat overloads; the modular signatures are restated here.
export const set = (ref: D.DatabaseReference, value: unknown): Promise<void> => reportWrite("set", ref, D.set(ref, value));
export const update = (ref: D.DatabaseReference, values: object): Promise<void> => reportWrite("update", ref, D.update(ref, values));
export const remove = (ref: D.DatabaseReference): Promise<void> => reportWrite("remove", ref, D.remove(ref));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const runTransaction = (ref: D.DatabaseReference, fn: (currentData: any) => unknown, options?: D.TransactionOptions): Promise<D.TransactionResult> => reportWrite("transaction", ref, D.runTransaction(ref, fn, options));
export const get = (query: D.Query): Promise<D.DataSnapshot> =>
  D.get(query).catch((err: unknown) => {
    noteFirebaseFailure("read", "get", rtdbPath(query), err);
    throw err;
  });

/** `push(ref)` only mints a key; `push(ref, value)` also writes, and that write is reported. */
export function push(ref: D.DatabaseReference, value?: unknown): D.ThenableReference {
  if (value === undefined) return D.push(ref);
  const thenable = D.push(ref, value);
  // A logging branch only: the caller still receives the original rejection.
  thenable.then(undefined, (err: unknown) => noteFirebaseFailure("write", "push", rtdbPath(ref), err));
  return thenable;
}

export const onDisconnect = (ref: D.DatabaseReference): D.OnDisconnect => {
  const od = D.onDisconnect(ref);
  const path = rtdbPath(ref);
  const wrap = <K extends "set" | "update" | "remove" | "cancel">(k: K) => {
    const orig = (od[k] as (...a: unknown[]) => Promise<void>).bind(od);
    (od as unknown as Record<K, (...a: unknown[]) => Promise<void>>)[k] = (...a: unknown[]) =>
      orig(...a).catch((err: unknown) => {
        noteFirebaseFailure("write", `onDisconnect.${k}`, path, err);
        throw err;
      });
  };
  wrap("set");
  wrap("update");
  wrap("remove");
  wrap("cancel");
  return od;
};

/**
 * Listeners: a cancel callback is always installed. Without one the SDK drops a
 * denied subscription silently and the screen waits forever; with ours the
 * denial is logged, then the caller's own cancel callback (if any) runs.
 */
type Snap = (snap: D.DataSnapshot) => unknown;
type ChildSnap = (snap: D.DataSnapshot, previousChildName?: string | null) => unknown;
type Cancel = (error: Error) => unknown;
type Listen<Cb> = {
  (query: D.Query, callback: Cb, cancelCallback?: Cancel): D.Unsubscribe;
  (query: D.Query, callback: Cb, options: D.ListenOptions): D.Unsubscribe;
  (query: D.Query, callback: Cb, cancelCallback: Cancel, options: D.ListenOptions): D.Unsubscribe;
};
function reported<Cb>(op: string, listen: Listen<Cb>): Listen<Cb> {
  return ((query: D.Query, cb: Cb, third?: Cancel | D.ListenOptions, fourth?: D.ListenOptions) => {
    const cancel = typeof third === "function" ? third : null;
    const options = cancel ? fourth : (third as D.ListenOptions | undefined);
    const onCancel: Cancel = (err) => {
      noteFirebaseFailure("read", op, rtdbPath(query), err);
      cancel?.(err);
    };
    return options === undefined ? listen(query, cb, onCancel) : listen(query, cb, onCancel, options);
  }) as Listen<Cb>;
}
export const onValue = reported<Snap>("onValue", D.onValue);
export const onChildAdded = reported<ChildSnap>("onChildAdded", D.onChildAdded);
