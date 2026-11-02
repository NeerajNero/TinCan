"use client";

import { format } from "date-fns";
import { AnimatePresence, m, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CloudImage } from "@/components/ui/CloudImage";
import { Portal, Z } from "@/components/ui/Portal";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { usePagedCollection } from "@/hooks/usePagedCollection";
import { usePair } from "@/hooks/usePair";
import { cn } from "@/lib/cn";
import { dateKeyToLocalDate } from "@/lib/dates";
import { loadSnapEntry, snapsQuery } from "@/lib/db/snaps";
import type { QueryDocumentSnapshot } from "@/lib/firebase/fs";
import { safeCloudinary } from "@/lib/safeUrl";
import { SNAPS_PAGE } from "@/lib/snap";
import type { SnapEntryDoc, SnapSummaryDoc } from "@/lib/types";

interface Day extends SnapSummaryDoc {
  id: string;
}
const mapDoc = (d: QueryDocumentSnapshot<SnapSummaryDoc>): Day => ({ id: d.id, ...d.data() });
const newestFirst = (a: Day, b: Day) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

/**
 * Memories → Snaps: days newest first (30 per page from the summaries), both
 * thumbnails and a late tag per day; tap a day for both snaps full size and
 * swipe between days. Only summaries are listed; a day's two entries load
 * when it opens (two reads). A day I skipped keeps the friend's snap hidden.
 */
export function SnapsScreen() {
  const { uid, friend, friendUid } = usePair();
  const makeQuery = useCallback((after: QueryDocumentSnapshot<SnapSummaryDoc> | null) => snapsQuery(after), []);
  const { items, ready, hasMore, loadingMore, loadMore } = usePagedCollection(makeQuery, SNAPS_PAGE, mapDoc, newestFirst);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const friendName = friend?.nickname ?? "Friend";

  return (
    <div className="flex flex-col gap-4">
      <SubHeader emoji="🤳" title="Snaps" help="snap" />
      {!ready && <ListSkeleton rows={2} tall />}
      {ready && items.length === 0 && <Card className="py-8 text-center text-muted">No snaps yet — the first snap time lands between 9:00 and 22:00.</Card>}
      <div className="grid grid-cols-2 gap-3">
        {items.map((day, i) => (
          <DayTile key={day.id} day={day} uid={uid} friendUid={friendUid} onOpen={() => setOpenIndex(i)} />
        ))}
      </div>
      {hasMore && (
        <Button variant="soft" onClick={loadMore} disabled={loadingMore} className="self-center">
          {loadingMore ? "Loading…" : "Load older"}
        </Button>
      )}
      <DayViewer days={items} index={openIndex} uid={uid} friendUid={friendUid} friendName={friendName} onIndex={setOpenIndex} onClose={() => setOpenIndex(null)} />
    </div>
  );
}

function DayTile({ day, uid, friendUid, onOpen }: { day: Day; uid: string; friendUid: string | null; onOpen: () => void }) {
  const mine = day.posted?.[uid] === true;
  const theirs = Boolean(friendUid && day.posted?.[friendUid]);
  const late = Boolean(day.late?.[uid] || (friendUid && day.late?.[friendUid]));
  return (
    <button type="button" onClick={onOpen} className="card tap flex flex-col gap-2 rounded-[24px] p-3 text-left" aria-label={`Snaps from ${format(dateKeyToLocalDate(day.id), "d MMM yyyy")}`}>
      <div className="flex gap-1.5">
        <Thumb src={mine ? safeCloudinary(day.thumbs?.[uid]) : null} missing={mine ? "none" : "skipped"} />
        <Thumb src={mine && theirs && friendUid ? safeCloudinary(day.thumbs?.[friendUid]) : null} missing={!theirs ? "skipped" : !mine ? "locked" : "none"} />
      </div>
      <div className="flex items-center justify-between gap-2 px-0.5">
        <span className="text-xs font-bold">{format(dateKeyToLocalDate(day.id), "EEE d MMM")}</span>
        {late && <span className="rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">late</span>}
      </div>
    </button>
  );
}

function Thumb({ src, missing }: { src: string | null; missing: "none" | "skipped" | "locked" }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- signed Cloudinary thumbnail stored on the summary
    return <img src={src} alt="" width={96} height={128} loading="lazy" decoding="async" className="aspect-[3/4] min-w-0 flex-1 rounded-xl bg-surface-2 object-cover" />;
  }
  return (
    <span className="grid aspect-[3/4] min-w-0 flex-1 place-items-center rounded-xl bg-surface-2 text-xl" aria-hidden>
      {missing === "locked" ? "🔒" : missing === "skipped" ? "🙈" : "📷"}
    </span>
  );
}

/* ── full view ─────────────────────────────────────────────────────────── */

interface Loaded {
  mine: SnapEntryDoc | null;
  theirs: SnapEntryDoc | null;
}

function DayViewer({ days, index, uid, friendUid, friendName, onIndex, onClose }: { days: Day[]; index: number | null; uid: string; friendUid: string | null; friendName: string; onIndex: (i: number) => void; onClose: () => void }) {
  const day = index !== null ? days[index] : undefined;
  const [loaded, setLoaded] = useState<Record<string, Loaded>>({});
  const { pair } = usePair();

  useEffect(() => {
    if (!day || loaded[day.id]) return;
    const mine = day.posted?.[uid] === true;
    const theirs = Boolean(friendUid && day.posted?.[friendUid]);
    let live = true;
    Promise.all([mine ? loadSnapEntry(day.id, uid) : Promise.resolve(null), mine && theirs && friendUid ? loadSnapEntry(day.id, friendUid) : Promise.resolve(null)])
      .then(([a, b]) => live && setLoaded((prev) => ({ ...prev, [day.id]: { mine: a, theirs: b } })))
      .catch(() => live && setLoaded((prev) => ({ ...prev, [day.id]: { mine: null, theirs: null } })));
    return () => {
      live = false;
    };
  }, [day, loaded, uid, friendUid]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
      if (e.key === "ArrowRight" && index < days.length - 1) onIndex(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, days.length, onIndex, onClose]);

  function onDragEnd(_: unknown, info: PanInfo) {
    if (index === null) return;
    if (info.offset.x < -70 && index < days.length - 1) onIndex(index + 1);
    else if (info.offset.x > 70 && index > 0) onIndex(index - 1);
    else if (info.offset.y > 120) onClose();
  }

  const entries = day ? loaded[day.id] : undefined;
  return (
    <Portal>
      <AnimatePresence>
        {day && index !== null && (
          <m.div key="snap-day" role="dialog" aria-label={`Snaps from ${format(dateKeyToLocalDate(day.id), "d MMMM yyyy")}`} className="fixed inset-0 flex flex-col bg-black text-white" style={{ zIndex: Z.viewer }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex items-center justify-between px-3 pt-[max(env(safe-area-inset-top),8px)]">
              <button type="button" onClick={() => onIndex(index - 1)} disabled={index === 0} aria-label="Newer day" className="tap grid size-11 place-items-center rounded-full bg-white/15 disabled:opacity-30">
                <ChevronLeft size={20} />
              </button>
              <p className="font-heading text-lg font-semibold">{format(dateKeyToLocalDate(day.id), "EEE d MMM yyyy")}</p>
              <div className="flex gap-1">
                <button type="button" onClick={() => onIndex(index + 1)} disabled={index >= days.length - 1} aria-label="Older day" className="tap grid size-11 place-items-center rounded-full bg-white/15 disabled:opacity-30">
                  <ChevronRight size={20} />
                </button>
                <button type="button" onClick={onClose} aria-label="Close" className="tap grid size-11 place-items-center rounded-full bg-white/15">
                  <X size={20} />
                </button>
              </div>
            </div>
            <m.div key={day.id} className="flex min-h-0 flex-1 flex-col justify-center gap-3 overflow-y-auto px-3 py-3 touch-pan-y" drag dragDirectionLock dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }} dragElastic={0.5} dragSnapToOrigin onDragEnd={onDragEnd} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}>
              <FullSnap who="You" entry={entries?.mine ?? null} loading={!entries} missing={day.posted?.[uid] ? null : "You skipped this day"} tz={pair.roomTz} />
              <FullSnap who={friendName} entry={entries?.theirs ?? null} loading={!entries} missing={!friendUid || !day.posted?.[friendUid] ? `${friendName} skipped this day` : !day.posted?.[uid] ? "Locked — you didn't post that day" : null} tz={pair.roomTz} />
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}

function FullSnap({ who, entry, loading, missing, tz }: { who: string; entry: SnapEntryDoc | null; loading: boolean; missing: string | null; tz: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      <div className="flex items-center justify-between text-xs text-white/70">
        <span className="font-bold uppercase tracking-wide">{who}</span>
        {entry?.late && <span className="rounded-full bg-amber-400/30 px-2 py-0.5 font-bold text-amber-200">late · {entry.lateByMin} min</span>}
      </div>
      <div className={cn("grid min-h-0 flex-1 place-items-center overflow-hidden rounded-2xl bg-white/5", loading && !missing && "animate-pulse")}>
        {missing ? (
          <p className="px-4 text-center text-sm text-white/60">{missing}</p>
        ) : entry ? (
          <CloudImage media={entry} alt={entry.caption} variant="full" className="max-h-full max-w-full object-contain" />
        ) : null}
      </div>
      {entry && (entry.caption || entry.at) && (
        <p className="truncate text-sm">
          {entry.caption}
          {entry.at && <span className="text-white/60"> · {format(entry.at.toDate(), tz ? "h:mm a" : "h:mm a")}</span>}
        </p>
      )}
    </div>
  );
}
