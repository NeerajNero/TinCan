"use client";

import { useEffect, type RefObject } from "react";

/**
 * The square drawing surface shared by the whiteboard and Pictionary: a
 * wrapper that takes the column width and a canvas whose bitmap follows it
 * (device-pixel aware). `onResize` repaints after every size change.
 */
export function CanvasFrame({ wrapRef, canvasRef, onResize, canvasProps, children }: { wrapRef: RefObject<HTMLDivElement | null>; canvasRef: RefObject<HTMLCanvasElement | null>; onResize: () => void; canvasProps?: React.CanvasHTMLAttributes<HTMLCanvasElement>; children?: React.ReactNode }) {
  useEffect(() => {
    const c = canvasRef.current;
    const wrap = wrapRef.current;
    if (!c || !wrap) return;
    const ro = new ResizeObserver(() => {
      const size = Math.floor(wrap.clientWidth);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = size * dpr;
      c.height = size * dpr;
      c.style.width = "100%";
      c.style.height = "100%";
      onResize();
    });
    ro.observe(wrap);
    return () => ro.disconnect();
    // onResize is a stable repaint trigger; the observer must not re-attach per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrapRef, canvasRef]);
  return (
    <div ref={wrapRef} data-grid="canvas" className="board relative aspect-square overflow-hidden rounded-[20px] border border-border bg-white shadow-sm [--board-max:480px]">
      <canvas ref={canvasRef} data-cell className="block size-full touch-none select-none" aria-label="Shared canvas" {...canvasProps} />
      {children}
    </div>
  );
}
