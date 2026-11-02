"use client";

import Link from "next/link";

import { useNow } from "@/hooks/useNow";
import { cn } from "@/lib/cn";
import { safeCloudinary } from "@/lib/safeUrl";
import { formatCountdown, SNAP_STREAK_SHOW_FROM, snapLateness, snapWindowLeftMs, type SnapCardState } from "@/lib/snap";
import type { SnapSchedule, SnapSummaryDoc } from "@/lib/types";

interface SnapCardProps {
  state: SnapCardState;
  schedule: SnapSchedule | null | undefined;
  summary: SnapSummaryDoc | null;
  uid: string;
  friendUid: string;
  friendName: string;
}

const accent = { "--accent": "var(--accent-memories)" } as React.CSSProperties;

/**
 * The daily snap on Home: a big "Snap time" card with a Take button while
 * it's my move (pinned to the top), a thin "waiting" row once I've posted,
 * two thumbnails once both have, nothing on days with no snap (yet).
 */
export function SnapCard({ state, schedule, summary, uid, friendUid, friendName }: SnapCardProps) {
  if (state === "hidden" || !schedule) return null;
  const streak = schedule.streak?.count ?? 0;
  const flame = streak >= SNAP_STREAK_SHOW_FROM ? <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold tabular-nums">🔥 {streak}</span> : null;

  if (state === "open" || state === "late") return <TakeCard late={state === "late"} todayAt={schedule.todayAt} flame={flame} />;

  if (state === "waiting") {
    return (
      <Link href="/snap" className="card tap flex items-center gap-3 rounded-[24px] px-4 py-3" style={accent}>
        <span className="text-3xl" aria-hidden>
          📸
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold uppercase tracking-wide text-muted">Daily snap</span>
          <span className="block truncate font-heading text-lg font-semibold leading-tight">Posted · waiting for {friendName}</span>
        </span>
        {flame}
      </Link>
    );
  }

  const mine = safeCloudinary(summary?.thumbs?.[uid]);
  const theirs = safeCloudinary(summary?.thumbs?.[friendUid]);
  return (
    <Link href="/snap" className="card tap flex items-center gap-3 rounded-[24px] px-4 py-3" style={accent} aria-label="Today's snaps">
      <span className="flex shrink-0 -space-x-2">
        <Thumb src={mine} alt="Your snap" />
        <Thumb src={theirs} alt={`${friendName}'s snap`} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold uppercase tracking-wide text-muted">Daily snap</span>
        <span className="block truncate font-heading text-lg font-semibold leading-tight">Both in today 📸</span>
      </span>
      {flame}
    </Link>
  );
}

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  if (!src) return <span className="grid size-12 place-items-center rounded-xl border-2 border-surface bg-surface-2 text-lg" aria-hidden>🙈</span>;
  // eslint-disable-next-line @next/next/no-img-element -- signed Cloudinary thumbnail stored on the summary
  return <img src={src} alt={alt} width={48} height={48} loading="lazy" decoding="async" className="size-12 rounded-xl border-2 border-surface bg-surface-2 object-cover" />;
}

function TakeCard({ late, todayAt, flame }: { late: boolean; todayAt: number; flame: React.ReactNode }) {
  const now = useNow(1000).getTime();
  const left = snapWindowLeftMs(todayAt, now);
  const { lateByMin } = snapLateness(todayAt, now);
  return (
    <div className={cn("card flex items-center gap-4 rounded-[24px] p-4", !late && "ring-2 ring-[var(--accent)]")} style={accent}>
      <span className={cn("text-4xl", !late && "animate-pulse")} aria-hidden>
        📸
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-heading text-xl font-semibold leading-tight">{late ? "Snap time passed" : `Snap time · ${formatCountdown(left)} left`}</p>
        <p className="text-xs text-muted">{late ? `Post yours anyway — it'll say late by ${lateByMin} min` : "Take a photo of right now, whatever it is"}</p>
      </div>
      {flame}
      <Link href="/snap" className="tap inline-flex shrink-0 items-center justify-center rounded-full bg-accent px-5 py-2.5 font-heading text-sm font-semibold text-accent-ink shadow-[0_8px_20px_-10px_var(--accent)]">
        Take
      </Link>
    </div>
  );
}
