"use client";

import { AnimatePresence, m, type PanInfo } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CloudImage } from "@/components/ui/CloudImage";
import { Portal, Z } from "@/components/ui/Portal";
import { safeCloudinary } from "@/lib/safeUrl";

interface ImageViewerProps {
  src: string | null;
  caption?: string;
  /** Small line under the caption, e.g. "Added by Neeraj · 3 Oct 2026". */
  meta?: string;
  /** Buttons for the bottom bar (save, edit, delete…). */
  actions?: React.ReactNode;
  onClose: () => void;
}

const MAX_SCALE = 4;

/** Full-screen photo: pinch (or double-tap) to zoom, drag to pan when zoomed, swipe down to close. */
export function ImageViewer({ src, caption, meta, actions, onClose }: ImageViewerProps) {
  return (
    <Portal>
      <AnimatePresence>
        {safeCloudinary(src) && <Viewer key={src} src={src as string} caption={caption} meta={meta} actions={actions} onClose={onClose} />}
      </AnimatePresence>
    </Portal>
  );
}

/** Keyed on `src`, so zoom and pan start fresh for every photo. */
function Viewer({ src, caption, meta, actions, onClose }: ImageViewerProps & { src: string }) {
  const [scale, setScale] = useState(1);
  const [pinching, setPinching] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const lastTap = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function onPointerDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      if (!a || !b) return;
      pinchStart.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale };
      panStart.current = null;
      setPinching(true);
    } else if (pointers.current.size === 1) {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        // double tap toggles zoom
        const next = scale > 1 ? 1 : 2.5;
        setScale(next);
        if (next === 1) setOffset({ x: 0, y: 0 });
        lastTap.current = 0;
      } else {
        lastTap.current = now;
      }
      if (scale > 1) panStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = Array.from(pointers.current.values());
      if (!a || !b) return;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const next = Math.min(MAX_SCALE, Math.max(1, (pinchStart.current.scale * dist) / pinchStart.current.dist));
      setScale(next);
      if (next === 1) setOffset({ x: 0, y: 0 });
    } else if (pointers.current.size === 1 && panStart.current && scale > 1) {
      setOffset({ x: panStart.current.ox + (e.clientX - panStart.current.x), y: panStart.current.oy + (e.clientY - panStart.current.y) });
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) {
      pinchStart.current = null;
      setPinching(false);
    }
    if (pointers.current.size === 0) panStart.current = null;
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    if (scale === 1 && (info.offset.y > 120 || info.velocity.y > 600)) onClose();
  }

  return (
        <m.div
          key="viewer"
          role="dialog"
          aria-label="Photo"
          className="fixed inset-0 flex flex-col bg-black"
          style={{ zIndex: Z.viewer }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button type="button" onClick={onClose} aria-label="Close" className="tap absolute top-[max(env(safe-area-inset-top),8px)] right-2 z-10 grid size-11 place-items-center rounded-full bg-white/15 text-white">
            <X size={20} />
          </button>
          <m.div
            className="flex min-h-0 flex-1 items-center justify-center touch-none select-none"
            drag={scale === 1 ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.6}
            dragSnapToOrigin
            onDragEnd={onDragEnd}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <CloudImage
              url={src}
              alt={caption ?? ""}
              variant="full"
              draggable={false}
              className="max-h-full max-w-full bg-transparent object-contain"
              style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transition: pinching ? "none" : "transform 0.15s" }}
            />
          </m.div>
          {(caption || meta || actions) && (
            <div className="flex flex-col items-center gap-2 bg-black/60 px-4 py-3 pb-[max(env(safe-area-inset-bottom),12px)] text-center text-white">
              {caption && <p className="text-sm">{caption}</p>}
              {meta && <p className="text-xs text-white/70">{meta}</p>}
              {actions && <div className="flex flex-wrap justify-center gap-2 pt-1">{actions}</div>}
            </div>
          )}
        </m.div>
  );
}

/** A pill button for the viewer's action row (shared by chat and Memories). */
export function ViewerButton({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`tap rounded-full px-4 py-2 text-sm font-bold ${danger ? "bg-red-500/80 text-white" : "bg-white/20 text-white"}`}>
      {children}
    </button>
  );
}
