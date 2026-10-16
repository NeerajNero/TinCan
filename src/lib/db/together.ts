/**
 * Shared surfaces in RTDB: whiteboard/pictionary strokes + live previews,
 * cursors, the 32×32 pixel grid, radio, and the focus timer.
 */
import { limitToLast, onValue, orderByKey, push, query, ref, remove, runTransaction, serverTimestamp, set, update } from "firebase/database";

import { getRtdb } from "@/lib/firebase/client";
import { swallow } from "@/lib/swallow";
export interface Stroke {
  uid: string;
  color: string;
  width: number;
  /** JSON "[[x,y],...]" with 0..1 normalised coordinates. */
  points: string;
}
export interface LiveStroke extends Stroke {
  at: number;
}
export interface CursorNode {
  x: number;
  y: number;
  page: string;
  at: number;
}

const MAX_STROKES = 500;
const r = (p: string) => ref(getRtdb(), p);

/* ── strokes (base = "whiteboard" or "pictionary/{id}") ────────────────── */

export function subscribeStrokes(base: string, cb: (strokes: Array<Stroke & { id: string }>) => void): () => void {
  const q = query(r(`${base}/strokes`), orderByKey(), limitToLast(MAX_STROKES));
  return onValue(q, (snap) => {
    const list: Array<Stroke & { id: string }> = [];
    snap.forEach((c) => {
      list.push({ id: c.key as string, ...(c.val() as Stroke) });
    });
    cb(list);
  });
}

export function subscribeLive(base: string, cb: (live: Record<string, LiveStroke>) => void): () => void {
  return onValue(r(`${base}/live`), (snap) => cb((snap.val() as Record<string, LiveStroke> | null) ?? {}));
}

export async function addStroke(base: string, stroke: Stroke, currentCount: number, oldestId: string | null): Promise<string> {
  const node = push(r(`${base}/strokes`));
  await set(node, stroke);
  if (currentCount >= MAX_STROKES && oldestId) await remove(r(`${base}/strokes/${oldestId}`)).catch(swallow);
  return node.key as string;
}

export const removeStroke = (base: string, id: string) => remove(r(`${base}/strokes/${id}`));
export const clearStrokes = (base: string) => set(r(`${base}/strokes`), null);
export const streamLive = (base: string, uid: string, stroke: Stroke | null) => set(r(`${base}/live/${uid}`), stroke ? { ...stroke, at: serverTimestamp() } : null);

/* ── cursors ───────────────────────────────────────────────────────────── */

export const cursorPath = (uid: string) => `cursors/${uid}`;
export const writeCursor = (uid: string, x: number, y: number, page: string) => set(r(cursorPath(uid)), { x, y, page, at: serverTimestamp() });
export const clearCursor = (uid: string) => remove(r(cursorPath(uid)));

/* ── pixel art ─────────────────────────────────────────────────────────── */

export const PIXEL_SIZE = 32;
export const PIXEL_CELLS = PIXEL_SIZE * PIXEL_SIZE;
export const PIXEL_PALETTE = ["#ffffff", "#000000", "#7f7f7f", "#c3c3c3", "#ff6b6b", "#ffb454", "#ffd166", "#5fd3a4", "#2a9d8f", "#6fb6ff", "#3a6ea5", "#b48cff", "#ff8fab", "#8b5e3c", "#f2d6b3", "#1d1d2b"] as const;
export const emptyGrid = () => "0".repeat(PIXEL_CELLS);

export function subscribePixelGrid(cb: (grid: string) => void): () => void {
  return onValue(r("pixel/grid"), (snap) => {
    const v = snap.val();
    cb(typeof v === "string" && v.length === PIXEL_CELLS ? v : emptyGrid());
  });
}

/** Apply many cell changes atomically: { index: paletteIndex }. */
export function paintCells(changes: Record<number, number>): Promise<void> {
  return runTransaction(r("pixel/grid"), (cur: unknown) => {
    const base = typeof cur === "string" && cur.length === PIXEL_CELLS ? cur : emptyGrid();
    const arr = base.split("");
    for (const [i, p] of Object.entries(changes)) arr[Number(i)] = p.toString(16);
    return arr.join("");
  }).then(() => undefined);
}

export const clearPixelGrid = () => set(r("pixel/grid"), emptyGrid());
export const pixelCursorPath = (uid: string) => `pixel/cursor/${uid}`;
export const writePixelCursor = (uid: string, index: number) => set(r(pixelCursorPath(uid)), { index, at: serverTimestamp() });
export const clearPixelCursor = (uid: string) => remove(r(pixelCursorPath(uid)));

/* ── radio ─────────────────────────────────────────────────────────────── */

export interface RadioNode {
  stationId: string | null;
  playing: boolean;
  by: string;
}
export const subscribeRadio = (cb: (n: RadioNode | null) => void) => onValue(r("radio/main"), (s) => cb(s.exists() ? (s.val() as RadioNode) : null));
export const setRadio = (node: RadioNode) => update(r("radio/main"), { ...node, at: serverTimestamp() });

/* ── focus timer ───────────────────────────────────────────────────────── */

type TimerMode = "focus" | "break";
export interface TimerNode {
  mode: TimerMode;
  /** Epoch ms (server clock) when the running phase ends; 0 when idle. */
  endsAt: number;
  running: boolean;
  startedBy: string;
  focusMin: number;
  breakMin: number;
  /** Remaining ms while paused. */
  remainingMs: number;
  /** The endsAt that was last counted as a completed focus session (idempotency). */
  lastCompletedEndsAt?: number;
}
export const DEFAULT_TIMER: TimerNode = { mode: "focus", endsAt: 0, running: false, startedBy: "", focusMin: 25, breakMin: 5, remainingMs: 25 * 60_000 };

export const subscribeTimer = (cb: (n: TimerNode | null) => void) => onValue(r("timer/main"), (s) => cb(s.exists() ? { ...DEFAULT_TIMER, ...(s.val() as Partial<TimerNode>) } : null));
export const writeTimer = (patch: Partial<TimerNode>) => update(r("timer/main"), patch);

/** First client to see the focus phase end claims the completion (returns true if it won). */
export async function claimFocusCompletion(endsAt: number): Promise<boolean> {
  const res = await runTransaction(r("timer/main"), (cur: TimerNode | null) => {
    if (!cur || cur.lastCompletedEndsAt === endsAt) return;
    return { ...cur, lastCompletedEndsAt: endsAt, mode: "break", running: false, endsAt: 0, remainingMs: (cur.breakMin ?? 5) * 60_000 };
  });
  return res.committed;
}

/* ── cook-along checklist ──────────────────────────────────────────────── */

export const subscribeCook = (recipeId: string, cb: (checked: Record<string, boolean>, by: string | null) => void) =>
  onValue(r(`cook/${recipeId}`), (s) => {
    const v = (s.val() as { checked?: Record<string, boolean>; by?: string } | null) ?? {};
    cb(v.checked ?? {}, v.by ?? null);
  });
export const setCookStep = (recipeId: string, step: number, done: boolean, by: string) => update(r(`cook/${recipeId}`), { [`checked/${step}`]: done ? true : null, by });
export const resetCook = (recipeId: string) => set(r(`cook/${recipeId}`), null);
