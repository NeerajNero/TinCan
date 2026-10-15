"use client";

import { format, formatDistanceStrict } from "date-fns";
import { onSnapshot, type QueryDocumentSnapshot } from "firebase/firestore";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { PhotoGrid } from "@/components/memories/PhotoGrid";
import { PhotoPicker } from "@/components/memories/PhotoPicker";
import { SubHeader } from "@/components/memories/SubHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { useNow } from "@/hooks/useNow";
import { usePair } from "@/hooks/usePair";
import { cn } from "@/lib/cn";
import { capsulesQuery, createCapsule, isUnlocked, MIN_LOCK_MS, openCapsule, readCapsuleBody } from "@/lib/db/capsules";
import { deleteViaServer } from "@/lib/db/deleteViaServer";
import { recordTogetherEvent } from "@/lib/garden";
import { uploadImages } from "@/lib/media/uploadImages";
import type { CapsuleBody, CapsuleDoc } from "@/lib/types";

interface Capsule extends CapsuleDoc {
  id: string;
}
const mapDoc = (d: QueryDocumentSnapshot<CapsuleDoc>): Capsule => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) });

function toLocalInputValue(date: Date) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function CapsulesScreen() {
  const { uid, me, friend } = usePair();
  const now = useNow(1000);
  const [items, setItems] = useState<Capsule[]>([]);
  const [ready, setReady] = useState(false);
  const [composing, setComposing] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(capsulesQuery(), (snap) => {
      setItems(snap.docs.map(mapDoc));
      setReady(true);
    });
    return () => {
      unsub();
      setItems([]);
      setReady(false);
    };
  }, []);

  const nameOf = (id: string) => (id === uid ? me.nickname : (friend?.nickname ?? "Friend"));

  return (
    <div className="flex flex-col gap-4">
      <SubHeader
        emoji="⏳"
        title="Time capsules"
        action={
          !composing ? (
            <Button onClick={() => setComposing(true)} className="px-4 py-2 text-sm">
              Seal one
            </Button>
          ) : null
        }
      />
      {composing && <CapsuleComposer uid={uid} onDone={() => setComposing(false)} />}
      {ready && items.length === 0 && !composing && <Card className="py-8 text-center text-muted">Nothing sealed yet. Write something for a future day?</Card>}
      {items.map((c) => (
        <CapsuleCard key={c.id} capsule={c} uid={uid} now={now} authorName={nameOf(c.authorId)} openerName={c.openedBy ? nameOf(c.openedBy) : null} />
      ))}
    </div>
  );
}

function CapsuleCard({ capsule, uid, now, authorName, openerName }: { capsule: Capsule; uid: string; now: Date; authorName: string; openerName: string | null }) {
  const unlocked = isUnlocked(capsule, now);
  const [body, setBody] = useState<CapsuleBody | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const opened = Boolean(capsule.openedAt);
  const mine = capsule.authorId === uid;

  async function open() {
    setBusy(true);
    setError(null);
    try {
      if (!opened) {
        await openCapsule(capsule.id, uid);
        void recordTogetherEvent("capsule", uid);
      }
      setBody(await readCapsuleBody(capsule.id));
    } catch {
      setError("Couldn't open it. Is it unlocked yet?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <motion.span className="text-3xl" aria-hidden animate={unlocked && !opened ? { rotate: [0, -8, 8, 0] } : { rotate: 0 }} transition={{ duration: 1.2, repeat: unlocked && !opened ? Infinity : 0, repeatDelay: 2 }}>
          {opened ? "📬" : unlocked ? "🔓" : "🔒"}
        </motion.span>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-lg font-semibold leading-tight">{capsule.title || "Untitled"}</p>
          <p className="text-xs text-muted">
            Sealed by {authorName}
            {capsule.photoCount > 0 && ` · ${capsule.photoCount} photo${capsule.photoCount === 1 ? "" : "s"}`}
          </p>
          <p className={cn("mt-1 text-sm", unlocked ? "text-emerald-600 dark:text-emerald-300" : "text-muted")}>
            {opened
              ? `Opened by ${openerName ?? "someone"} on ${format(capsule.openedAt!.toDate(), "d MMM yyyy")}`
              : unlocked
                ? "Unlocked — open it!"
                : `Unlocks in ${formatDistanceStrict(now, capsule.unlockAt.toDate())} · ${format(capsule.unlockAt.toDate(), "d MMM yyyy, h:mm a")}`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {!body && (unlocked || mine) && (
          <Button onClick={open} disabled={busy} variant={unlocked ? "primary" : "soft"} className="px-5">
            {busy ? "Opening…" : opened || mine ? "Read" : "Open"}
          </Button>
        )}
        {mine && !unlocked && (
          <Button variant="ghost" disabled={busy} onClick={() => void deleteViaServer("capsule", capsule.id).catch(() => setError("Couldn't unseal it."))}>
            Take it back
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <AnimatePresence>
        {body && (
          <motion.div key="body" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-3">
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{body.body}</p>
            <PhotoGrid media={body.media ?? []} />
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function CapsuleComposer({ uid, onDone }: { uid: string; onDone: () => void }) {
  const [openedAt] = useState(() => Date.now());
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [when, setWhen] = useState(() => toLocalInputValue(new Date(openedAt + 24 * 60 * 60 * 1000)));
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const unlockAt = when ? new Date(when) : null;
  const tooSoon = !unlockAt || Number.isNaN(unlockAt.getTime()) || unlockAt.getTime() - openedAt < MIN_LOCK_MS;
  const canSave = title.trim().length > 0 && body.trim().length > 0 && !tooSoon && progress === null;

  async function seal() {
    if (!canSave || !unlockAt) return;
    setError(null);
    setProgress(0);
    try {
      const media = files.length ? await uploadImages(files, setProgress) : [];
      await createCapsule(uid, title, body, unlockAt, media);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't seal it. Try again?");
    } finally {
      setProgress(null);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cap-title">Title</Label>
        <Input id="cap-title" value={title} onChange={(e) => setTitle(e.target.value.slice(0, 80))} placeholder="For your birthday" autoFocus />
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, 4000))}
        placeholder="Dear future us…"
        rows={5}
        aria-label="Letter"
        className="w-full resize-none rounded-2xl border border-border bg-surface-2 px-4 py-3 text-[15px] focus:border-[var(--accent)] focus:outline-none"
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cap-when">Unlocks at</Label>
        <Input id="cap-when" type="datetime-local" value={when} min={toLocalInputValue(new Date(openedAt + MIN_LOCK_MS))} onChange={(e) => setWhen(e.target.value)} />
        {tooSoon && when && <p className="text-xs text-muted">Pick a time at least an hour from now.</p>}
      </div>
      <PhotoPicker files={files} onChange={setFiles} />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone} disabled={progress !== null}>
          Cancel
        </Button>
        <Button onClick={seal} disabled={!canSave} className="px-5">
          {progress !== null ? (files.length ? `Uploading ${Math.round(progress * 100)}%` : "Sealing…") : "Seal it"}
        </Button>
      </div>
    </Card>
  );
}
