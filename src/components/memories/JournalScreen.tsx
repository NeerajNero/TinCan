"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";

import { PhotoGrid } from "@/components/memories/PhotoGrid";
import { PhotoPicker } from "@/components/memories/PhotoPicker";
import { SubHeader } from "@/components/memories/SubHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { usePagedCollection } from "@/hooks/usePagedCollection";
import { usePair } from "@/hooks/usePair";
import { cn } from "@/lib/cn";
import { deleteViaServer } from "@/lib/db/deleteViaServer";
import { addJournalEntry, deleteJournalEntry, editJournalEntry, JOURNAL_PAGE, journalQuery } from "@/lib/db/journal";
import type { QueryDocumentSnapshot } from "@/lib/firebase/fs";
import { autoFocusRef } from "@/lib/focus";
import { uploadImages } from "@/lib/media/uploadImages";
import { errorMessage } from "@/lib/swallow";
import { MOOD_EMOJI, type JournalDoc } from "@/lib/types";


interface Entry extends JournalDoc {
  id: string;
}
const mapDoc = (d: QueryDocumentSnapshot<JournalDoc>): Entry => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) });
const newestFirst = (a: Entry, b: Entry) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0);

export function JournalScreen() {
  const { uid, me, friend } = usePair();
  const makeQuery = useCallback((after: QueryDocumentSnapshot<JournalDoc> | null) => journalQuery(after), []);
  const { items, ready, hasMore, loadingMore, loadMore } = usePagedCollection(makeQuery, JOURNAL_PAGE, mapDoc, newestFirst);
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <SubHeader
        emoji="📓"
        title="Journal"
        action={
          !composing && !editing ? (
            <Button onClick={() => setComposing(true)} className="px-4 py-2 text-sm">
              Write
            </Button>
          ) : null
        }
      />
      {(composing || editing) && (
        <Composer
          key={editing?.id ?? "new"}
          uid={uid}
          entry={editing}
          onDone={() => {
            setComposing(false);
            setEditing(null);
          }}
        />
      )}
      {!ready && <ListSkeleton tall />}
      {ready && items.length === 0 && !composing && <Card className="py-8 text-center text-muted">No entries yet — write the first one?</Card>}
      {items.map((e) => {
        const mine = e.authorId === uid;
        const author = mine ? me : friend;
        return (
          <Card key={e.id} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              {author ? <Avatar user={author} size={36} /> : <span className="size-9 rounded-full bg-surface-2" />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {author?.nickname ?? "Friend"} <span className="text-lg">{e.mood}</span>
                </p>
                <p className="text-xs text-muted">
                  {e.createdAt ? formatDistanceToNowStrict(e.createdAt.toDate(), { addSuffix: true }) : "just now"}
                  {e.editedAt && " · edited"}
                </p>
              </div>
              {mine && (
                <div className="flex">
                  <button type="button" onClick={() => setEditing(e)} aria-label="Edit entry" className="tap grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2">
                    <Pencil size={16} />
                  </button>
                  <button type="button" onClick={() => void deleteViaServer("journal", e.id).catch(() => deleteJournalEntry(e.id))} aria-label="Delete entry" className="tap grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2">
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{e.text}</p>
            <PhotoGrid media={e.media ?? []} />
          </Card>
        );
      })}
      {hasMore && (
        <Button variant="soft" onClick={loadMore} disabled={loadingMore} className="self-center">
          {loadingMore ? "Loading…" : "Load older"}
        </Button>
      )}
    </div>
  );
}

function Composer({ uid, entry, onDone }: { uid: string; entry: Entry | null; onDone: () => void }) {
  const [text, setText] = useState(entry?.text ?? "");
  const [mood, setMood] = useState(entry?.mood ?? MOOD_EMOJI[0]);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canSave = text.trim().length > 0 && progress === null;

  async function save() {
    if (!canSave) return;
    setError(null);
    setProgress(0);
    try {
      if (entry) {
        await editJournalEntry(entry.id, text, mood);
      } else {
        const media = files.length ? await uploadImages(files, setProgress) : [];
        await addJournalEntry(uid, text, mood, media);
      }
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Couldn't save. Try again?"));
    } finally {
      setProgress(null);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 4000))}
        placeholder="What happened today?"
        rows={4}
        ref={autoFocusRef}
        aria-label="Journal entry"
        className="w-full resize-none rounded-2xl border border-border bg-surface-2 px-4 py-3 text-[15px] focus:border-[var(--accent)] focus:outline-none"
      />
      <div role="radiogroup" aria-label="Mood" className="flex flex-wrap gap-1">
        {MOOD_EMOJI.map((m) => (
          <button key={m} type="button" role="radio" aria-checked={mood === m} onClick={() => setMood(m)} className={cn("tap grid place-items-center rounded-2xl text-2xl", mood === m ? "bg-accent-soft" : "hover:bg-surface-2")}>
            {m}
          </button>
        ))}
      </div>
      {!entry && <PhotoPicker files={files} onChange={setFiles} />}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone} disabled={progress !== null}>
          Cancel
        </Button>
        <Button onClick={save} disabled={!canSave} className="px-5">
          {progress !== null ? (files.length ? `Uploading ${Math.round(progress * 100)}%` : "Saving…") : entry ? "Save" : "Post"}
        </Button>
      </div>
    </Card>
  );
}
