"use client";

import { formatInTimeZone } from "date-fns-tz";
import { useEffect, useState } from "react";

import { ImageViewer } from "@/components/chat/media/ImageViewer";
import { SubHeader } from "@/components/memories/SubHeader";
import { BlurredSnap, SnapCapture } from "@/components/snap/SnapCapture";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CloudImage } from "@/components/ui/CloudImage";
import { useNow } from "@/hooks/useNow";
import { usePair } from "@/hooks/usePair";
import { useStartInvite } from "@/hooks/useStartInvite";
import { cn } from "@/lib/cn";
import { roomDateKey } from "@/lib/dates";
import { loadSnapEntry, saveSnapToMemories, snapRef } from "@/lib/db/snaps";
import { onSnapshot } from "@/lib/firebase/fs";
import { inviteCooldownLeft } from "@/lib/invites";
import { formatCountdown, SNAP_STREAK_SHOW_FROM, SNAP_WINDOW_MS, snapWindowLeftMs } from "@/lib/snap";
import { swallow } from "@/lib/swallow";
import type { SnapEntryDoc, SnapSchedule, SnapSummaryDoc } from "@/lib/types";

/**
 * /snap — camera first (`SnapCapture`, also used by the Home takeover). Before
 * posting the friend's snap is a blurred placeholder (never fetched: the rule
 * refuses it anyway); after posting both snaps sit side by side with captions,
 * times, a "later" tag and Save to memories. "Waiting for X" offers the
 * invite-style nudge.
 */
export function SnapScreen() {
  const { uid, friend, friendUid, pair } = usePair();
  const now = useNow(1000);
  const today = roomDateKey(pair, now);
  const schedule = pair.snap?.todayKey === today ? pair.snap : null;
  const [summary, setSummary] = useState<SnapSummaryDoc | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(snapRef(today), (snap) => setSummary(snap.exists() ? snap.data() : null));
    return () => {
      unsub();
      setSummary(null);
    };
  }, [today]);

  const streak = pair.snap?.streak?.count ?? 0;
  const posted = summary?.posted?.[uid] === true;
  const friendPosted = Boolean(friendUid && summary?.posted?.[friendUid]);
  const friendName = friend?.nickname ?? "your friend";

  return (
    <div className="flex flex-col gap-4">
      <SubHeader emoji="📸" title="Daily snap" back="/" help="snap" action={streak >= SNAP_STREAK_SHOW_FROM ? <span className="rounded-full bg-surface-2 px-2.5 py-1 text-sm font-bold tabular-nums">🔥 {streak}</span> : null} />
      {!schedule || now.getTime() < schedule.todayAt ? (
        <Card className="flex flex-col items-center gap-2 py-8 text-center">
          <span className="text-5xl" aria-hidden>
            📸
          </span>
          <p className="font-heading text-xl font-semibold">No snap yet today</p>
          <p className="text-sm text-muted">It lands at a surprise minute between 9:00 and 22:00. The next time you open Tincan after it, you get two minutes.</p>
        </Card>
      ) : !friendUid ? null : (
        <Day key={today} today={today} schedule={schedule} uid={uid} friendUid={friendUid} friendName={friendName} posted={posted} friendPosted={friendPosted} nowMs={now.getTime()} tz={pair.roomTz} />
      )}
    </div>
  );
}

interface DayProps {
  today: string;
  schedule: SnapSchedule;
  uid: string;
  friendUid: string;
  friendName: string;
  posted: boolean;
  friendPosted: boolean;
  nowMs: number;
  tz: string;
}

function Day({ today, schedule, uid, friendUid, friendName, posted, friendPosted, nowMs, tz }: DayProps) {
  const [mine, setMine] = useState<SnapEntryDoc | null>(null);
  const [theirs, setTheirs] = useState<SnapEntryDoc | null>(null);

  useEffect(() => {
    if (!posted || mine) return;
    let live = true;
    loadSnapEntry(today, uid)
      .then((e) => live && setMine(e))
      .catch(swallow);
    return () => {
      live = false;
    };
  }, [posted, mine, today, uid]);

  useEffect(() => {
    if (!posted || !friendPosted || theirs) return;
    let live = true;
    loadSnapEntry(today, friendUid)
      .then((e) => live && setTheirs(e))
      .catch(swallow);
    return () => {
      live = false;
    };
  }, [posted, friendPosted, theirs, today, friendUid]);

  if (!posted) {
    // Opened from the (opt-in) push inside the two minutes after the minute → on time; from the Home card later → later.
    const deadline = schedule.todayAt + SNAP_WINDOW_MS;
    return (
      <div className="flex flex-col gap-3">
        <Card className={cn("flex items-center gap-3 py-3", nowMs <= deadline && "ring-2 ring-[var(--accent)]")}>
          <span className="text-3xl" aria-hidden>
            ⏱️
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-xl font-semibold tabular-nums">{nowMs <= deadline ? `${formatCountdown(snapWindowLeftMs(deadline, nowMs))} to post on time` : "Post today's snap"}</p>
            <p className="text-xs text-muted">{nowMs <= deadline ? "Snap what's in front of you right now" : "It'll be marked “later” — still counts for the streak"}</p>
          </div>
        </Card>
        <SnapCapture today={today} uid={uid} friendName={friendName} friendPosted={friendPosted} deadline={deadline} onPosted={setMine} />
      </div>
    );
  }
  return <Results today={today} uid={uid} friendUid={friendUid} friendName={friendName} mine={mine} theirs={friendPosted ? theirs : null} friendPosted={friendPosted} tz={tz} />;
}

/* ── results ───────────────────────────────────────────────────────────── */

function Results({ today, uid, friendUid, friendName, mine, theirs, friendPosted, tz }: { today: string; uid: string; friendUid: string; friendName: string; mine: SnapEntryDoc | null; theirs: SnapEntryDoc | null; friendPosted: boolean; tz: string }) {
  const [viewing, setViewing] = useState<SnapEntryDoc | null>(null);
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <SnapTile who="You" entryUid={uid} entry={mine} today={today} viewerUid={uid} tz={tz} onOpen={setViewing} />
        {friendPosted ? (
          <SnapTile who={friendName} entryUid={friendUid} entry={theirs} today={today} viewerUid={uid} tz={tz} onOpen={setViewing} />
        ) : (
          <Waiting friendName={friendName} />
        )}
      </div>
      <ImageViewer media={viewing} caption={viewing?.caption} onClose={() => setViewing(null)} />
    </>
  );
}

function SnapTile({ who, entryUid, entry, today, viewerUid, tz, onOpen }: { who: string; entryUid: string; entry: SnapEntryDoc | null; today: string; viewerUid: string; tz: string; onOpen: (e: SnapEntryDoc) => void }) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const isSaved = saved || entry?.savedToMemories === true;
  async function save() {
    if (!entry || busy) return;
    setBusy(true);
    try {
      await saveSnapToMemories(viewerUid, today, entryUid, entry);
      setSaved(true);
    } catch {
      // The toast layer isn't worth it here; the button simply stays.
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="flex flex-col gap-2 p-2">
      <div className="flex items-center justify-between px-1">
        <p className="truncate text-xs font-bold uppercase tracking-wide text-muted">{who}</p>
        {entry?.later && <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">later</span>}
      </div>
      {entry ? (
        <button type="button" onClick={() => onOpen(entry)} aria-label={`Open ${who === "You" ? "your" : `${who}'s`} snap`} className="block overflow-hidden rounded-2xl bg-surface-2">
          <CloudImage media={entry} alt={entry.caption} w={entry.w} h={entry.h} sizes="45vw" className="aspect-[3/4] w-full object-cover" />
        </button>
      ) : (
        <div className="aspect-[3/4] w-full animate-pulse rounded-2xl bg-surface-2" aria-hidden />
      )}
      <div className="min-h-9 px-1">
        {entry?.caption && <p className="line-clamp-2 text-sm">{entry.caption}</p>}
        {entry?.at && <p className="text-[11px] text-muted">{formatInTimeZone(entry.at.toDate(), tz, "h:mm a")}</p>}
      </div>
      <Button variant="soft" onClick={() => void save()} disabled={!entry || busy || isSaved} className="px-3 py-1.5 text-xs">
        {isSaved ? "Saved ✓" : "Save to memories"}
      </Button>
    </Card>
  );
}

function Waiting({ friendName }: { friendName: string }) {
  const startInvite = useStartInvite();
  const now = useNow(1000).getTime();
  const left = inviteCooldownLeft("snap", now);
  return (
    <Card className="flex flex-col items-center justify-center gap-2 p-3 text-center">
      <BlurredSnap />
      <p className="text-sm font-semibold">Waiting for {friendName}</p>
      <p className="text-xs text-muted">They&apos;ll see yours once they post</p>
      <Button variant="soft" onClick={() => void startInvite("snap", "/snap", "the daily snap — post yours!")} disabled={left > 0} className="px-3 py-1.5 text-xs">
        {left > 0 ? "Nudged ✓" : "Nudge"}
      </Button>
    </Card>
  );
}
