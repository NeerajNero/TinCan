"use client";

import { format } from "date-fns";
import { AnimatePresence, m } from "framer-motion";
import { useEffect, useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { usePair } from "@/hooks/usePair";
import { cn } from "@/lib/cn";
import { envelopesByMe, envelopesForMe, openEnvelope, readEnvelopeBody, writeEnvelope } from "@/lib/db/envelopes";
import { onSnapshot, type QueryDocumentSnapshot } from "@/lib/firebase/fs";
import { recordTogetherEvent } from "@/lib/garden";
import { notify } from "@/lib/notify";
import { ENVELOPE_LABELS, type EnvelopeDoc } from "@/lib/types";

interface Envelope extends EnvelopeDoc {
  id: string;
}
const mapDoc = (d: QueryDocumentSnapshot<EnvelopeDoc>): Envelope => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) });
const newestFirst = (a: Envelope, b: Envelope) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0);

export function EnvelopesScreen() {
  const { uid, friend, friendUid } = usePair();
  const [forMe, setForMe] = useState<Envelope[]>([]);
  const [byMe, setByMe] = useState<Envelope[]>([]);
  const [composing, setComposing] = useState(false);

  useEffect(() => {
    const a = onSnapshot(envelopesForMe(uid), (snap) => setForMe(snap.docs.map(mapDoc).sort(newestFirst)));
    const b = onSnapshot(envelopesByMe(uid), (snap) => setByMe(snap.docs.map(mapDoc).sort(newestFirst)));
    return () => {
      a();
      b();
    };
  }, [uid]);

  const friendName = friend?.nickname ?? "your friend";

  return (
    <div className="flex flex-col gap-4">
      <SubHeader
        emoji="💌"
        title="Open when…"
        action={
          !composing && friendUid ? (
            <Button onClick={() => setComposing(true)} className="px-4 py-2 text-sm">
              Write one
            </Button>
          ) : null
        }
      />
      {composing && friendUid && <EnvelopeComposer uid={uid} forUid={friendUid} friendName={friendName} onDone={() => setComposing(false)} />}

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-muted">For you, from {friendName}</h2>
        {forMe.length === 0 && <Card className="py-6 text-center text-sm text-muted">No envelopes yet. They&apos;ll show up here, sealed.</Card>}
        {forMe.map((e) => (
          <EnvelopeCard key={e.id} envelope={e} uid={uid} canOpen onOpened={() => void notify("envelope-opened", { toUid: e.authorId, body: `opened your “open when ${e.label}” envelope 💌` })} />
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-muted">You wrote for {friendName}</h2>
        {byMe.length === 0 && <Card className="py-6 text-center text-sm text-muted">Write one for a day they&apos;ll need it.</Card>}
        {byMe.map((e) => (
          <EnvelopeCard key={e.id} envelope={e} uid={uid} canOpen={false} />
        ))}
      </section>
    </div>
  );
}

function EnvelopeCard({ envelope, canOpen, onOpened, uid }: { envelope: Envelope; canOpen: boolean; onOpened?: () => void; uid: string }) {
  const opened = Boolean(envelope.openedAt);
  const [body, setBody] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [unsealing, setUnsealing] = useState(false);

  async function reveal() {
    setBusy(true);
    try {
      if (canOpen && !opened) {
        setUnsealing(true);
        await new Promise((r) => setTimeout(r, 700));
        const b = await openEnvelope(envelope.id);
        setBody(b?.body ?? "");
        onOpened?.();
        void recordTogetherEvent("envelope", uid);
      } else {
        const b = await readEnvelopeBody(envelope.id);
        setBody(b?.body ?? "");
      }
    } catch {
      setBody(null);
    } finally {
      setBusy(false);
      setUnsealing(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3 overflow-hidden">
      <div className="flex items-center gap-3">
        <m.span className="text-3xl" aria-hidden animate={unsealing ? { rotateX: [0, 80, 0], scale: [1, 1.15, 1] } : { rotateX: 0, scale: 1 }} transition={{ duration: 0.7, ease: "easeInOut" }}>
          {opened || body !== null ? "📭" : "✉️"}
        </m.span>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-lg font-semibold leading-tight">Open when {envelope.label}</p>
          <p className={cn("text-xs", opened ? "text-emerald-600 dark:text-emerald-300" : "text-muted")}>
            {opened ? `Opened ${envelope.openedAt ? format(envelope.openedAt.toDate(), "d MMM yyyy") : ""}` : "Sealed"}
          </p>
        </div>
        {body === null && (canOpen || !canOpen) && (
          <Button onClick={reveal} disabled={busy} variant={canOpen && !opened ? "primary" : "soft"} className="px-4 py-2 text-sm">
            {busy ? "…" : canOpen && !opened ? "Open" : "Read"}
          </Button>
        )}
      </div>
      <AnimatePresence>
        {body !== null && (
          <m.p key="body" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="whitespace-pre-wrap rounded-2xl bg-surface-2 p-3 text-[15px] leading-relaxed">
            {body}
          </m.p>
        )}
      </AnimatePresence>
    </Card>
  );
}

function EnvelopeComposer({ uid, forUid, friendName, onDone }: { uid: string; forUid: string; friendName: string; onDone: () => void }) {
  const [label, setLabel] = useState<string>(ENVELOPE_LABELS[0]);
  const [custom, setCustom] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const finalLabel = label === "custom" ? custom.trim() : label;
  const canSave = finalLabel.length > 0 && body.trim().length > 0 && !busy;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    try {
      await writeEnvelope(uid, forUid, finalLabel, body);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-sm text-muted">For {friendName} to open when they&apos;re…</p>
      <div role="radiogroup" aria-label="Label" className="flex flex-wrap gap-1.5">
        {[...ENVELOPE_LABELS, "custom"].map((l) => (
          <button key={l} type="button" role="radio" aria-checked={label === l} onClick={() => setLabel(l)} className={cn("tap rounded-full px-3 py-1.5 text-sm font-bold", label === l ? "bg-[var(--accent)] text-white" : "bg-surface-2 text-muted")}>
            {l === "custom" ? "custom…" : l}
          </button>
        ))}
      </div>
      {label === "custom" && <Input value={custom} onChange={(e) => setCustom(e.target.value.slice(0, 40))} placeholder="feeling homesick" aria-label="Custom label" autoFocus />}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, 4000))}
        placeholder="Hey. If you're reading this…"
        rows={5}
        aria-label="Letter"
        className="w-full resize-none rounded-2xl border border-border bg-surface-2 px-4 py-3 text-[15px] focus:border-[var(--accent)] focus:outline-none"
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={save} disabled={!canSave} className="px-5">
          {busy ? "Sealing…" : "Seal it"}
        </Button>
      </div>
    </Card>
  );
}
