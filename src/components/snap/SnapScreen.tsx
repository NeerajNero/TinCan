"use client";

import { formatInTimeZone } from "date-fns-tz";
import { Camera, Images, RefreshCw, SwitchCamera } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ImageViewer } from "@/components/chat/media/ImageViewer";
import { SubHeader } from "@/components/memories/SubHeader";
import { useToast } from "@/components/toast/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CloudImage } from "@/components/ui/CloudImage";
import { Input } from "@/components/ui/Input";
import { useNow } from "@/hooks/useNow";
import { usePair } from "@/hooks/usePair";
import { useStartInvite } from "@/hooks/useStartInvite";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { cn } from "@/lib/cn";
import { roomDateKey } from "@/lib/dates";
import { loadSnapEntry, postSnap, saveSnapToMemories, snapRef } from "@/lib/db/snaps";
import { onSnapshot } from "@/lib/firebase/fs";
import { haptic } from "@/lib/haptics";
import { inviteCooldownLeft } from "@/lib/invites";
import { compressImage } from "@/lib/media/compress";
import { formatCountdown, SNAP_CAPTION_MAX, SNAP_STREAK_SHOW_FROM, snapLateness, snapWindowLeftMs } from "@/lib/snap";
import { errorMessage, swallow } from "@/lib/swallow";
import type { SnapEntryDoc, SnapSchedule, SnapSummaryDoc } from "@/lib/types";

/**
 * /snap — camera first. Before posting the friend's snap is a blurred
 * placeholder (never fetched: the rule refuses it anyway); after posting both
 * snaps sit side by side with captions, times, a "late" tag and Save to
 * memories. "Waiting for X" offers the invite-style nudge.
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
          <p className="text-sm text-muted">It lands at a surprise minute between 9:00 and 22:00. You&apos;ll both get a push, then you have two minutes.</p>
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

  if (!posted) return <Capture today={today} schedule={schedule} uid={uid} friendName={friendName} friendPosted={friendPosted} nowMs={nowMs} onPosted={setMine} />;
  return <Results today={today} uid={uid} friendUid={friendUid} friendName={friendName} mine={mine} theirs={friendPosted ? theirs : null} friendPosted={friendPosted} tz={tz} />;
}

/* ── capture ───────────────────────────────────────────────────────────── */

function Capture({ today, schedule, uid, friendName, friendPosted, nowMs, onPosted }: { today: string; schedule: SnapSchedule; uid: string; friendName: string; friendPosted: boolean; nowMs: number; onPosted: (e: SnapEntryDoc) => void }) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [file, setFile] = useState<File | null>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const [caption, setCaption] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Camera first: try to open it on arrival (browsers may want a tap; the big button is the fallback).
  useEffect(() => {
    const t = setTimeout(() => cameraInput.current?.click(), 150);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const left = snapWindowLeftMs(schedule.todayAt, nowMs);
  const lateness = snapLateness(schedule.todayAt, nowMs);

  function pick(list: FileList | null) {
    const f = list?.[0];
    if (f && f.type.startsWith("image/")) setFile(f);
    if (cameraInput.current) cameraInput.current.value = "";
    if (galleryInput.current) galleryInput.current.value = "";
  }

  function flip() {
    setFacing((f) => (f === "environment" ? "user" : "environment"));
    setFile(null);
    setTimeout(() => cameraInput.current?.click(), 0);
  }

  async function post() {
    if (!file || progress !== null) return;
    setError(null);
    setProgress(0);
    try {
      const { blob, w, h } = await compressImage(file);
      const up = await uploadToCloudinary(blob, { kind: "image", folder: "snaps", onProgress: setProgress });
      const at = snapLateness(schedule.todayAt, Date.now());
      const entry = await postSnap(uid, today, { url: up.url, publicId: up.publicId, variants: up.variants, w: up.w ?? w, h: up.h ?? h }, caption, at);
      haptic("success");
      toast({ key: "snap", emoji: "📸", title: at.late ? `Posted, late by ${at.lateByMin} min` : "Snap posted!", body: friendPosted ? `${friendName}'s is unlocked` : `Now waiting for ${friendName}`, vibrate: false });
      onPosted(entry);
    } catch (err) {
      haptic("error");
      setError(errorMessage(err, "Couldn't post the snap. Try again?"));
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className={cn("flex items-center gap-3 py-3", !lateness.late && "ring-2 ring-[var(--accent)]")}>
        <span className="text-3xl" aria-hidden>
          ⏱️
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-xl font-semibold tabular-nums">{lateness.late ? `Late by ${lateness.lateByMin} min` : `${formatCountdown(left)} left`}</p>
          <p className="text-xs text-muted">{lateness.late ? "Post still works — it just gets a late tag" : "Snap what's in front of you right now"}</p>
        </div>
      </Card>

      <input ref={cameraInput} type="file" accept="image/*" capture={facing} hidden onChange={(e) => pick(e.target.files)} />
      <input ref={galleryInput} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files)} />

      {preview ? (
        <Card className="flex flex-col gap-3 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
          <img src={preview} alt="Your snap" className="max-h-[50dvh] w-full rounded-2xl bg-surface-2 object-contain" />
          <Input value={caption} onChange={(e) => setCaption(e.target.value.slice(0, SNAP_CAPTION_MAX))} placeholder="Caption (optional)" aria-label="Caption" maxLength={SNAP_CAPTION_MAX} />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" onClick={() => setFile(null)} disabled={progress !== null} className="px-4 py-2 text-sm">
              <RefreshCw size={16} aria-hidden />
              Retake
            </Button>
            <Button onClick={() => void post()} disabled={progress !== null} className="px-6">
              {progress !== null ? `Posting ${Math.round(progress * 100)}%` : lateness.late ? "Post (late)" : "Post"}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="flex flex-col items-center gap-3 py-6 text-center">
          <Button onClick={() => cameraInput.current?.click()} className="px-8 py-4 text-lg">
            <Camera size={22} aria-hidden />
            Open camera
          </Button>
          <div className="flex gap-2">
            <Button variant="soft" onClick={flip} className="px-4 py-2 text-sm">
              <SwitchCamera size={16} aria-hidden />
              {facing === "environment" ? "Flip to selfie" : "Back camera"}
            </Button>
            <Button variant="soft" onClick={() => galleryInput.current?.click()} className="px-4 py-2 text-sm">
              <Images size={16} aria-hidden />
              Choose from gallery
            </Button>
          </div>
        </Card>
      )}

      <Card className="flex items-center gap-3 py-3">
        <BlurredSnap />
        <p className="min-w-0 flex-1 text-sm text-muted">{friendPosted ? `${friendName} has posted · post yours to see it` : `${friendName} hasn't posted yet`}</p>
      </Card>
    </div>
  );
}

function BlurredSnap() {
  return (
    <span className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-surface-2" aria-hidden>
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,var(--accent),transparent_60%),radial-gradient(circle_at_70%_70%,var(--accent-soft),transparent_60%)] opacity-70 blur-md" />
      <span className="relative text-2xl">👀</span>
    </span>
  );
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
        {entry?.late && <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">late · {entry.lateByMin} min</span>}
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
