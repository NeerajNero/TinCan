"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/lib/cn";
import { clearNote, setNote } from "@/lib/db/users";
import { NOTE_EMOJI, NOTE_MAX, noteLine } from "@/lib/notes";
import { notify } from "@/lib/notify";
import { errorMessage } from "@/lib/swallow";
import type { UserNote } from "@/lib/types";

interface NoteSheetProps {
  open: boolean;
  uid: string;
  current: UserNote | null;
  onClose: () => void;
}

/** Write, replace or clear my 24-hour note; saving tells the friend (`note` push). */
export function NoteSheet({ open, uid, current, onClose }: NoteSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} label="Your note" className="flex flex-col gap-3 px-5">
      <NoteForm uid={uid} current={current} onClose={onClose} />
    </Sheet>
  );
}

function NoteForm({ uid, current, onClose }: Omit<NoteSheetProps, "open">) {
  const [text, setText] = useState(current?.text ?? "");
  const [emoji, setEmoji] = useState<string | null>(current?.emoji ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = text.trim();

  async function save() {
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await setNote(uid, trimmed, emoji);
      void notify("note", { body: noteLine({ text: trimmed, ...(emoji ? { emoji } : {}) }) });
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Couldn't save the note"));
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    try {
      await clearNote(uid);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className="font-heading text-xl font-semibold">{current ? "Change your note" : "Leave a note"}</h2>
      <p className="text-sm text-muted">One line over your avatar on {"their"} Home for 24 hours.</p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pick an emoji">
        {NOTE_EMOJI.map((e) => (
          <button key={e} type="button" onClick={() => setEmoji((cur) => (cur === e ? null : e))} aria-label={`Emoji ${e}`} aria-pressed={emoji === e} className={cn("tap grid size-11 place-items-center rounded-2xl text-2xl", emoji === e ? "bg-accent-soft" : "bg-surface-2")}>
            {e}
          </button>
        ))}
      </div>
      <Input value={text} onChange={(e) => setText(e.target.value.slice(0, NOTE_MAX))} placeholder="What's up right now?" aria-label="Note" maxLength={NOTE_MAX} autoFocus />
      <p className="-mt-1 text-right text-[11px] text-muted">
        {text.length}/{NOTE_MAX}
      </p>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex justify-end gap-2">
        {current && (
          <Button variant="ghost" onClick={() => void clear()} disabled={busy}>
            Clear
          </Button>
        )}
        <Button onClick={() => void save()} disabled={!trimmed || busy} className="px-6">
          {busy ? "Saving…" : "Post note"}
        </Button>
      </div>
    </>
  );
}
