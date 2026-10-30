"use client";

import Link from "next/link";
import { useRef } from "react";

import { cn } from "@/lib/cn";
import type { PlayEntry } from "@/lib/play/catalog";

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE_PX = 10;

/** A tile's status: the full line for big tiles, a word or two for the pill on compact ones. */
export interface TileBadge {
  text: string;
  short: string;
  hot: boolean;
}

/**
 * Long-press (touch) or right-click (mouse) opens the tile menu; the click that
 * ends a long-press is swallowed. A finger that moves (the row scrolling) cancels.
 */
function usePressMenu(onMenu: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const suppress = useRef(false);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    onPointerDown(e: React.PointerEvent) {
      if (e.pointerType === "mouse") return;
      cancel();
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        timer.current = null;
        suppress.current = true;
        try {
          navigator.vibrate?.(15);
        } catch {
          // no haptics
        }
        onMenu();
      }, LONG_PRESS_MS);
    },
    onPointerMove(e: React.PointerEvent) {
      const o = origin.current;
      if (timer.current && o && (Math.abs(e.clientX - o.x) > MOVE_TOLERANCE_PX || Math.abs(e.clientY - o.y) > MOVE_TOLERANCE_PX)) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu(e: React.MouseEvent) {
      e.preventDefault();
      if (suppress.current) return;
      cancel();
      onMenu();
    },
    onClick(e: React.MouseEvent) {
      if (!suppress.current) return;
      suppress.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };
}

interface TileProps {
  entry: PlayEntry;
  badge: TileBadge | null;
  /** The sub-label when there is no badge (big tiles only). */
  blurb?: string;
  pinned?: boolean;
  disabled?: boolean;
  /** Board games start or resume from the lobby; screens of their own are links. */
  onOpen?: () => void;
  onMenu: () => void;
}

/** Emoji + short label, 3.5 to a row; the badge is a small pill in the corner. */
export function CompactTile({ entry, badge, pinned, disabled, onOpen, onMenu }: TileProps) {
  const press = usePressMenu(onMenu);
  const className = cn("card tap relative flex snap-start flex-col items-center justify-center gap-1 rounded-[20px] px-1 py-3 text-center select-none", disabled && "opacity-60");
  const style = { flex: "0 0 calc((100% - 1.5rem) / 3.5)" };
  const body = (
    <>
      {badge && <span className={cn("absolute -top-1.5 right-1 max-w-[90%] truncate rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-tight shadow-sm", badge.hot ? "bg-[var(--accent)] text-white" : "bg-surface-2 text-muted")}>{badge.short}</span>}
      {pinned && !badge && (
        <span className="absolute -top-1 right-1 text-[11px]" aria-label="Pinned">
          📌
        </span>
      )}
      <span className="text-2xl leading-none" aria-hidden>
        {entry.emoji}
      </span>
      <span className="w-full truncate text-[11px] font-bold leading-tight">{entry.short}</span>
    </>
  );
  const label = badge ? `${entry.name} · ${badge.text}` : entry.name;
  if (onOpen)
    return (
      <button type="button" aria-label={label} disabled={disabled} style={style} className={className} {...press} onClick={(e) => (press.onClick(e), e.defaultPrevented ? undefined : onOpen())}>
        {body}
      </button>
    );
  return (
    <Link href={entry.href} aria-label={label} aria-disabled={disabled} style={style} className={className} {...press}>
      {body}
    </Link>
  );
}

/** The two-column tile with the full sub-label. */
export function BigTile({ entry, badge, blurb, pinned, disabled, onOpen, onMenu }: TileProps) {
  const press = usePressMenu(onMenu);
  const className = cn("card tap relative flex flex-col items-start gap-1.5 rounded-[24px] p-4 text-left select-none", disabled && "opacity-60");
  const body = (
    <>
      {pinned && (
        <span className="absolute top-3 right-3 text-sm" aria-label="Pinned">
          📌
        </span>
      )}
      <span className="text-3xl" aria-hidden>
        {entry.emoji}
      </span>
      <span className="font-heading text-lg font-semibold leading-tight">{entry.name}</span>
      <span className={cn("text-xs", badge?.hot ? "font-bold text-[var(--accent)]" : "text-muted")}>{badge?.text ?? blurb ?? ""}</span>
    </>
  );
  if (onOpen)
    return (
      <button type="button" disabled={disabled} className={className} {...press} onClick={(e) => (press.onClick(e), e.defaultPrevented ? undefined : onOpen())}>
        {body}
      </button>
    );
  return (
    <Link href={entry.href} aria-disabled={disabled} className={className} {...press}>
      {body}
    </Link>
  );
}
