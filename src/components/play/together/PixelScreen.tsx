"use client";

import { Eraser, PaintBucket, Pen } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { ToolBtn } from "@/components/play/together/WhiteboardScreen";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useNow } from "@/hooks/useNow";
import { usePair } from "@/hooks/usePair";
import { useRtdbValue } from "@/hooks/useRtdbValue";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { cn } from "@/lib/cn";
import { sendMedia } from "@/lib/db/messages";
import { clearPixelCursor, clearPixelGrid, emptyGrid, paintCells, PIXEL_CELLS, PIXEL_PALETTE, PIXEL_SIZE, pixelCursorPath, subscribePixelGrid, writePixelCursor } from "@/lib/db/together";
import { recordTogetherEvent } from "@/lib/garden";
import { notify } from "@/lib/notify";

type Tool = "pen" | "fill" | "eraser";

export function PixelScreen() {
  const { uid, friend, friendUid } = usePair();
  const [grid, setGrid] = useState(emptyGrid);
  const [tool, setTool] = useState<Tool>("pen");
  const [colour, setColour] = useState(1);
  const [confirmClear, setConfirmClear] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const pending = useRef<Record<number, number>>({});
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const painting = useRef(false);
  const lastCursor = useRef(0);
  const first = useRef(false);
  const { value: friendCursor } = useRtdbValue<{ index: number; at: number }>(friendUid ? pixelCursorPath(friendUid) : null);
  const now = useNow(5000);

  useEffect(() => subscribePixelGrid(setGrid), []);
  useEffect(() => () => void clearPixelCursor(uid), [uid]);

  function flush() {
    const batch = pending.current;
    pending.current = {};
    flushTimer.current = null;
    if (Object.keys(batch).length) void paintCells(batch);
  }
  function queue(i: number, p: number) {
    if (grid[i] === p.toString(16) && pending.current[i] === undefined) return;
    pending.current[i] = p;
    setGrid((g) => {
      const a = g.split("");
      a[i] = p.toString(16);
      return a.join("");
    });
    if (!flushTimer.current) flushTimer.current = setTimeout(flush, 50);
    if (!first.current) {
      first.current = true;
      void recordTogetherEvent("pixel", uid);
    }
  }
  function fill(start: number) {
    const target = grid[start];
    const replacement = colour.toString(16);
    if (target === replacement) return;
    const changes: Record<number, number> = {};
    const stack = [start];
    const seen = new Set<number>();
    while (stack.length) {
      const i = stack.pop() as number;
      if (seen.has(i) || grid[i] !== target) continue;
      seen.add(i);
      changes[i] = colour;
      const x = i % PIXEL_SIZE;
      if (x > 0) stack.push(i - 1);
      if (x < PIXEL_SIZE - 1) stack.push(i + 1);
      if (i >= PIXEL_SIZE) stack.push(i - PIXEL_SIZE);
      if (i < PIXEL_CELLS - PIXEL_SIZE) stack.push(i + PIXEL_SIZE);
    }
    setGrid((g) => {
      const a = g.split("");
      for (const k of Object.keys(changes)) a[Number(k)] = replacement;
      return a.join("");
    });
    void paintCells(changes);
    if (!first.current) {
      first.current = true;
      void recordTogetherEvent("pixel", uid);
    }
  }
  function cellAt(e: React.PointerEvent): number | null {
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const i = el?.dataset.cell;
    return i === undefined ? null : Number(i);
  }
  function apply(i: number) {
    if (tool === "fill") fill(i);
    else queue(i, tool === "eraser" ? 0 : colour);
  }
  function onDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const i = cellAt(e);
    if (i === null) return;
    painting.current = tool !== "fill";
    apply(i);
  }
  function onMove(e: React.PointerEvent) {
    const i = cellAt(e);
    if (i === null) return;
    const now = Date.now();
    if (now - lastCursor.current > 50) {
      lastCursor.current = now;
      void writePixelCursor(uid, i);
    }
    if (painting.current) apply(i);
  }
  function onUp() {
    painting.current = false;
  }

  async function snapshot() {
    if (snapping) return;
    setSnapping(true);
    try {
      const c = document.createElement("canvas");
      c.width = 320;
      c.height = 320;
      const ctx = c.getContext("2d")!;
      const cell = 320 / PIXEL_SIZE;
      for (let i = 0; i < PIXEL_CELLS; i++) {
        ctx.fillStyle = PIXEL_PALETTE[parseInt(grid[i] ?? "0", 16)] ?? "#fff";
        ctx.fillRect((i % PIXEL_SIZE) * cell, Math.floor(i / PIXEL_SIZE) * cell, cell, cell);
      }
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
      if (!blob) return;
      const up = await uploadToCloudinary(blob, { kind: "image" });
      const id = await sendMedia(uid, "image", { url: up.url, publicId: up.publicId, w: 320, h: 320, bytes: up.bytes }, "🟪 Pixel art");
      if (friendUid) void notify("message", { toUid: friendUid, body: "📷 Pixel art", data: { messageId: id } });
    } finally {
      setSnapping(false);
    }
  }

  const friendIdx = friendCursor && now.getTime() - friendCursor.at < 15_000 ? friendCursor.index : null;

  return (
    <div className="-mb-6 flex min-h-0 flex-1 flex-col gap-3">
      <SubHeader
        emoji="🟪"
        title="Pixel art"
        back="/play"
        screenName="pixel art"
        action={
          <Button variant="soft" onClick={snapshot} disabled={snapping} className="px-3 py-2 text-sm">
            {snapping ? "Sending…" : "Snapshot"}
          </Button>
        }
      />
      <div className="relative mx-auto w-full max-w-[400px] overflow-hidden rounded-[16px] border border-border bg-white shadow-sm">
        <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} className="grid touch-none select-none" style={{ gridTemplateColumns: `repeat(${PIXEL_SIZE}, 1fr)` }} role="img" aria-label="Pixel canvas">
          {Array.from({ length: PIXEL_CELLS }, (_, i) => (
            <span key={i} data-cell={i} className="aspect-square" style={{ background: PIXEL_PALETTE[parseInt(grid[i] ?? "0", 16)] ?? "#fff" }} />
          ))}
        </div>
        {friendIdx !== null && friend && (
          <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${((friendIdx % PIXEL_SIZE) + 0.5) * (100 / PIXEL_SIZE)}%`, top: `${(Math.floor(friendIdx / PIXEL_SIZE) + 0.5) * (100 / PIXEL_SIZE)}%` }} aria-hidden>
            <Avatar user={friend} size={20} className="ring-2 ring-white shadow" />
          </div>
        )}
      </div>
      <div className="card flex flex-col gap-2 rounded-[20px] p-2">
        <div className="flex items-center gap-1">
          <ToolBtn active={tool === "pen"} onClick={() => setTool("pen")} label="Pen"><Pen size={18} /></ToolBtn>
          <ToolBtn active={tool === "fill"} onClick={() => setTool("fill")} label="Fill bucket"><PaintBucket size={18} /></ToolBtn>
          <ToolBtn active={tool === "eraser"} onClick={() => setTool("eraser")} label="Eraser"><Eraser size={18} /></ToolBtn>
          <span className="flex-1" />
          {!confirmClear ? (
            <button type="button" onClick={() => setConfirmClear(true)} className="tap rounded-full px-3 text-sm font-bold text-muted">Clear</button>
          ) : (
            <span className="flex items-center gap-1">
              <button type="button" onClick={() => setConfirmClear(false)} className="tap rounded-full px-2 text-xs font-bold text-muted">Keep</button>
              <button type="button" onClick={() => { void clearPixelGrid(); setConfirmClear(false); }} className="tap rounded-full bg-red-500 px-3 text-xs font-bold text-white">Clear all</button>
            </span>
          )}
        </div>
        <div role="radiogroup" aria-label="Palette" className="grid grid-cols-8 gap-1 px-1">
          {PIXEL_PALETTE.map((c, i) => (
            <button key={c} type="button" role="radio" aria-checked={colour === i} aria-label={c} onClick={() => { setColour(i); if (tool === "eraser") setTool("pen"); }} className={cn("tap grid place-items-center rounded-full", colour === i && tool !== "eraser" && "ring-2 ring-text ring-offset-2 ring-offset-surface")}>
              <span className="block size-7 rounded-full border border-border" style={{ background: c }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
