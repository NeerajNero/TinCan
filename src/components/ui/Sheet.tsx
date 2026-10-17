"use client";

import { AnimatePresence, m, type PanInfo } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { Portal, Z } from "@/components/ui/Portal";
import { cn } from "@/lib/cn";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name of the dialog. */
  label: string;
  children: React.ReactNode;
  /** Classes for the content column (gap, alignment, horizontal padding; default px-4). */
  className?: string;
  /** Panel background (default the surface colour). */
  tone?: "surface" | "bg";
  /** Fixed panel height (e.g. "70dvh"); otherwise it fits its content up to `maxHeight`. */
  height?: string;
  /** The content scrolls inside the panel when taller than this (default 85dvh). */
  maxHeight?: string;
  /** Set false when the content manages its own scrolling (a chat list). */
  scroll?: boolean;
  /** Opens at `height`; dragging (or tapping) the grabber up expands to this, down collapses or closes. */
  expandedHeight?: string;
}

/**
 * Keeps showing the last non-null value while a sheet animates out, so a menu
 * driven by `message | null` doesn't collapse to an empty panel on close.
 * (React's "adjust state when a prop changes" pattern; no effect needed.)
 */
export function useStickyValue<T>(value: T | null): T | null {
  const [last, setLast] = useState(value);
  if (value !== null && value !== last) setLast(value);
  return value ?? last;
}

/**
 * The one bottom sheet. Portalled to <body> so `position: fixed` always means
 * the screen, aligned to the bottom above the safe-area inset, over a scrim,
 * and stacked above the tab bar, the chat header and Leaflet's panes. Children
 * mount only while open, so per-open state starts fresh. Escape closes it.
 */
export function Sheet({ open, onClose, label, children, className, tone = "surface", height, maxHeight = "85dvh", scroll = true, expandedHeight }: SheetProps) {
  const [expanded, setExpanded] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) setExpanded(false);
  }
  const big = Boolean(expandedHeight && expanded);
  const panned = useRef(false);
  function onGrabberPan(_: unknown, info: PanInfo) {
    panned.current = true;
    if (info.offset.y < -30) setExpanded(true);
    else if (info.offset.y > 60) {
      if (big) setExpanded(false);
      else onClose();
    }
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <>
            <m.button
              key="scrim"
              type="button"
              aria-label="Close"
              tabIndex={-1}
              onClick={onClose}
              className="fixed inset-0 bg-black/30"
              style={{ zIndex: Z.scrim }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <m.div
              key="sheet"
              role="dialog"
              aria-modal="true"
              aria-label={label}
              className={cn(
                "fixed inset-x-0 bottom-0 mx-auto flex w-full max-w-[480px] flex-col rounded-t-[28px] pt-3 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.3)]",
                tone === "bg" ? "bg-bg" : "bg-surface",
              )}
              style={{
                zIndex: Z.sheet,
                height: big ? expandedHeight : height,
                maxHeight: big ? expandedHeight : maxHeight,
                paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
                transition: expandedHeight ? "height 220ms ease, max-height 220ms ease" : undefined,
              }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 38 }}
            >
              {expandedHeight ? (
                <m.button
                  type="button"
                  onPanEnd={onGrabberPan}
                  onPointerDown={() => (panned.current = false)}
                  onClick={() => !panned.current && setExpanded((v) => !v)}
                  aria-label={big ? "Shrink" : "Expand"}
                  aria-expanded={big}
                  className="-mt-3 mb-1 grid h-8 w-full shrink-0 cursor-grab touch-none place-items-center"
                >
                  <span className="h-1.5 w-10 rounded-full bg-border" aria-hidden />
                </m.button>
              ) : (
                <div className="mx-auto mb-3 h-1.5 w-10 shrink-0 rounded-full bg-border" aria-hidden />
              )}
              <div className={cn("flex min-h-0 flex-1 flex-col", scroll ? "overflow-y-auto overscroll-contain" : "overflow-hidden", className ?? "px-4")}>{children}</div>
            </m.div>
          </>
        )}
      </AnimatePresence>
    </Portal>
  );
}
