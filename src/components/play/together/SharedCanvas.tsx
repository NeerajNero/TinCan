"use client";

import { useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { useNow } from "@/hooks/useNow";
import { usePair } from "@/hooks/usePair";
import { useRtdbValue } from "@/hooks/useRtdbValue";
import { addStroke, clearCursor, cursorPath, removeStroke, streamLive, subscribeLive, subscribeStrokes, writeCursor, type CursorNode, type LiveStroke, type Stroke } from "@/lib/db/together";

export const CANVAS_COLORS = ["#3b2f3a", "#ff6b6b", "#ffb454", "#ffd166", "#5fd3a4", "#6fb6ff", "#b48cff", "#ff8fab"] as const;
export const CANVAS_WIDTHS = [3, 7, 14] as const;
export type Tool = "pen" | "eraser";

const THROTTLE_MS = 50;
const ERASER = "#ffffff";

interface SharedCanvasProps {
  /** "whiteboard" or "pictionary/{id}". */
  base: string;
  canDraw: boolean;
  tool: Tool;
  color: string;
  width: number;
  /** Shared cursors only where the spec wants them. */
  cursors?: boolean;
  page: string;
  onFirstStroke?: () => void;
  /** Exposes undo/snapshot to the parent toolbar. */
  controls?: (c: { undo: () => void; toPng: () => Promise<Blob | null>; count: number }) => void;
}

type Pt = [number, number];

function drawStroke(ctx: CanvasRenderingContext2D, s: Pick<Stroke, "color" | "width" | "points">, w: number, h: number) {
  let pts: Pt[];
  try {
    pts = JSON.parse(s.points) as Pt[];
  } catch {
    return;
  }
  if (pts.length === 0) return;
  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.width * (w / 400);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0][0] * w, pts[0][1] * h);
  if (pts.length === 1) ctx.lineTo(pts[0][0] * w + 0.1, pts[0][1] * h);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * w, pts[i][1] * h);
  ctx.stroke();
}

export function SharedCanvas({ base, canDraw, tool, color, width, cursors = false, page, onFirstStroke, controls }: SharedCanvasProps) {
  const { uid, friend, friendUid } = usePair();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [strokes, setStrokes] = useState<Array<Stroke & { id: string }>>([]);
  const [live, setLive] = useState<Record<string, LiveStroke>>({});
  const current = useRef<Pt[] | null>(null);
  const lastStream = useRef(0);
  const lastCursor = useRef(0);
  const firstDone = useRef(false);
  const { value: friendCursor } = useRtdbValue<CursorNode>(cursors && friendUid ? cursorPath(friendUid) : null);
  const now = useNow(5000);

  useEffect(() => subscribeStrokes(base, setStrokes), [base]);
  useEffect(() => subscribeLive(base, setLive), [base]);
  useEffect(() => () => void (cursors && clearCursor(uid)), [cursors, uid]);

  // Repaint on every change (≤500 strokes; fine).
  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const { width: w, height: h } = c;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    for (const s of strokes) drawStroke(ctx, s, w, h);
    for (const [who, s] of Object.entries(live)) if (who !== uid && s) drawStroke(ctx, s, w, h);
    if (current.current) drawStroke(ctx, { color: tool === "eraser" ? ERASER : color, width: tool === "eraser" ? width * 2 : width, points: JSON.stringify(current.current) }, w, h);
  });

  // Size the bitmap to the element (square, device-pixel aware).
  useEffect(() => {
    const c = canvasRef.current;
    const wrap = wrapRef.current;
    if (!c || !wrap) return;
    const ro = new ResizeObserver(() => {
      const size = Math.floor(wrap.clientWidth);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = size * dpr;
      c.height = size * dpr;
      c.style.width = `${size}px`;
      c.style.height = `${size}px`;
      setStrokes((s) => [...s]); // repaint
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    controls?.({
      undo: () => {
        const mine = [...strokes].reverse().find((s) => s.uid === uid);
        if (mine) void removeStroke(base, mine.id);
      },
      toPng: () => new Promise((resolve) => canvasRef.current?.toBlob((b) => resolve(b), "image/png")),
      count: strokes.length,
    });
  }, [controls, strokes, base, uid]);

  function norm(e: React.PointerEvent): Pt {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)), Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))];
  }
  const strokeMeta = () => ({ uid, color: tool === "eraser" ? ERASER : color, width: tool === "eraser" ? width * 2 : width });

  function onDown(e: React.PointerEvent) {
    if (!canDraw) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    current.current = [norm(e)];
    setLive((l) => ({ ...l })); // trigger paint
  }
  function onMove(e: React.PointerEvent) {
    const now = Date.now();
    if (cursors && now - lastCursor.current > THROTTLE_MS) {
      lastCursor.current = now;
      const [x, y] = norm(e);
      void writeCursor(uid, x, y, page);
    }
    if (!current.current) return;
    current.current.push(norm(e));
    setLive((l) => ({ ...l }));
    if (now - lastStream.current > THROTTLE_MS) {
      lastStream.current = now;
      void streamLive(base, uid, { ...strokeMeta(), points: JSON.stringify(current.current) });
    }
  }
  async function onUp() {
    const pts = current.current;
    current.current = null;
    if (!pts) return;
    void streamLive(base, uid, null);
    const oldest = strokes[0]?.id ?? null;
    await addStroke(base, { ...strokeMeta(), points: JSON.stringify(pts) }, strokes.length, oldest);
    if (!firstDone.current) {
      firstDone.current = true;
      onFirstStroke?.();
    }
  }

  return (
    <div ref={wrapRef} className="relative w-full overflow-hidden rounded-[20px] border border-border bg-white shadow-sm">
      <canvas ref={canvasRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={() => void onUp()} className="block w-full touch-none select-none" aria-label="Shared canvas" />
      {cursors && friendCursor && friend && now.getTime() - (friendCursor.at ?? 0) < 15_000 && (
        <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${friendCursor.x * 100}%`, top: `${friendCursor.y * 100}%` }} aria-hidden>
          <Avatar user={friend} size={22} className="ring-2 ring-white shadow" />
        </div>
      )}
    </div>
  );
}
