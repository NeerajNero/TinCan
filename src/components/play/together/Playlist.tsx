"use client";

import { AnimatePresence, m } from "framer-motion";
import { ChevronDown, ListPlus, Star } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import type { PlaylistRowsProps } from "@/components/play/together/PlaylistRows";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { readPref, writePref } from "@/lib/localPref";
import type { PlaylistItem, PlaylistRoom } from "@/lib/playlist";

const CHIP_MS = 5000;

/** ★ next to the current title: hollow when not saved, filled when saved (tap again removes, with Undo). */
export function StarButton({ saved, onToggle, className }: { saved: boolean; onToggle: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={saved}
      aria-label={saved ? "Remove from playlist" : "Save to playlist"}
      className={cn("tap grid size-11 shrink-0 place-items-center rounded-full", saved ? "text-amber-500" : "text-muted", className)}
    >
      <Star size={22} fill={saved ? "currentColor" : "none"} />
    </button>
  );
}

/** After a new link loads: a small "Save to playlist?" chip for 5 s. */
export function useSaveSuggestion() {
  const [suggestion, setSuggestion] = useState<{ videoId: string; title: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const suggest = (videoId: string, title: string) => {
    if (timer.current) clearTimeout(timer.current);
    setSuggestion({ videoId, title });
    timer.current = setTimeout(() => setSuggestion(null), CHIP_MS);
  };
  return { suggestion, suggest, dismiss: () => setSuggestion(null) };
}

export function SaveChip({ show, onSave }: { show: boolean; onSave: () => void }) {
  return (
    <AnimatePresence>
      {show && (
        <m.button
          key="chip"
          type="button"
          onClick={onSave}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="tap flex items-center gap-1.5 self-start rounded-full bg-accent-soft px-4 text-sm font-bold"
        >
          <Star size={16} /> Save to playlist?
        </m.button>
      )}
    </AnimatePresence>
  );
}

interface PlaylistSectionProps extends Omit<PlaylistRowsProps, "items"> {
  room: PlaylistRoom;
  items: PlaylistItem[] | null;
  /** Listen only: append every unqueued row to the live queue. */
  onQueueAll?: () => void;
}

const LazyRows = dynamic(() => import("@/components/play/together/PlaylistRows").then((mod) => mod.PlaylistRows), { ssr: false, loading: () => <ListSkeleton rows={2} /> });

/** Collapsible "Playlist (N)" under the player; open/closed remembered per room on this device. */
export function PlaylistSection({ room, items, onQueueAll, ...rows }: PlaylistSectionProps) {
  const prefKey = `tincan.playlist.open.${room}`;
  const [open, setOpen] = useState(() => readPref(prefKey) === "1");
  const list = items ?? [];
  const toggle = () => {
    setOpen((v) => {
      writePref(prefKey, v ? "0" : "1");
      return !v;
    });
  };
  const unqueued = rows.queuedIds ? list.filter((i) => !rows.queuedIds?.has(i.videoId)).length : 0;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={toggle} aria-expanded={open} className="tap flex flex-1 items-center gap-2 px-1 text-sm font-bold uppercase tracking-wide text-muted">
          <ChevronDown size={16} className={cn("transition-transform", open && "rotate-180")} aria-hidden />
          Playlist ({list.length})
        </button>
        {open && onQueueAll && list.length > 0 && (
          <button type="button" onClick={onQueueAll} disabled={unqueued === 0} className="tap flex items-center gap-1 rounded-full bg-accent-soft px-3 text-xs font-bold disabled:opacity-50">
            <ListPlus size={14} /> Queue all
          </button>
        )}
      </div>
      {open && items !== null && list.length === 0 && <p className="card rounded-[20px] px-4 py-5 text-center text-sm text-muted">Save videos with ★ to build your list together.</p>}
      {open && list.length > 0 && <LazyRows items={list} {...rows} />}
    </section>
  );
}
