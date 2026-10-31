"use client";

import { PIXEL_CELLS, PIXEL_PALETTE, PIXEL_SIZE } from "@/lib/db/together";

/** The 32×32 shared canvas as a CSS grid; `grid` is the 1024-char palette-index string. Pointer handlers come from the screen. */
export function PixelGrid({ grid, onPointerDown, onPointerMove, onPointerUp, onPointerCancel }: { grid: string; onPointerDown?: (e: React.PointerEvent) => void; onPointerMove?: (e: React.PointerEvent) => void; onPointerUp?: (e: React.PointerEvent) => void; onPointerCancel?: (e: React.PointerEvent) => void }) {
  return (
    <div data-grid="pixel" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} className="grid aspect-square touch-none select-none" style={{ gridTemplateColumns: `repeat(${PIXEL_SIZE}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${PIXEL_SIZE}, minmax(0, 1fr))` }} role="img" aria-label="Pixel canvas">
      {Array.from({ length: PIXEL_CELLS }, (_, i) => (
        <span key={i} data-cell={i} className="min-h-0 min-w-0" style={{ background: PIXEL_PALETTE[parseInt(grid[i] ?? "0", 16)] ?? "#fff" }} />
      ))}
    </div>
  );
}
