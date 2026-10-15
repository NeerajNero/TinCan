"use client";

import { format } from "date-fns";
import { onSnapshot, type QueryDocumentSnapshot } from "firebase/firestore";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ImageViewer } from "@/components/chat/media/ImageViewer";
import { PhotoPicker } from "@/components/memories/PhotoPicker";
import { SubHeader } from "@/components/memories/SubHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { usePagedCollection } from "@/hooks/usePagedCollection";
import { usePair } from "@/hooks/usePair";
import { thumbUrl } from "@/lib/cloudinary";
import { deleteViaServer } from "@/lib/db/deleteViaServer";
import { addMemories, editMemory, MEMORIES_PAGE, memoriesQuery } from "@/lib/db/memories";
import { placesQuery } from "@/lib/db/places";
import { uploadImages } from "@/lib/media/uploadImages";
import type { MemoryDoc, PlaceDoc } from "@/lib/types";

interface Memory extends MemoryDoc {
  id: string;
}
interface Place extends PlaceDoc {
  id: string;
}
const mapDoc = (d: QueryDocumentSnapshot<MemoryDoc>): Memory => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) });
const newestFirst = (a: Memory, b: Memory) => b.takenAt.toMillis() - a.takenAt.toMillis();
const toDateInput = (d: Date) => format(d, "yyyy-MM-dd");

export function PhotosScreen() {
  const { uid, me, friend } = usePair();
  const makeQuery = useCallback((after: QueryDocumentSnapshot<MemoryDoc> | null) => memoriesQuery(after), []);
  const { items, ready, hasMore, loadingMore, loadMore } = usePagedCollection(makeQuery, MEMORIES_PAGE, mapDoc, newestFirst);
  const [places, setPlaces] = useState<Place[]>([]);
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<Memory | null>(null);
  const [editing, setEditing] = useState<Memory | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(placesQuery(), (snap) => setPlaces(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, []);

  const months = useMemo(() => {
    const groups: Array<{ key: string; label: string; items: Memory[] }> = [];
    for (const m of items) {
      const date = m.takenAt.toDate();
      const key = format(date, "yyyy-MM");
      const last = groups[groups.length - 1];
      if (last?.key === key) last.items.push(m);
      else groups.push({ key, label: format(date, "MMMM yyyy"), items: [m] });
    }
    return groups;
  }, [items]);

  const nameOf = (id: string) => (id === uid ? me.nickname : (friend?.nickname ?? "Friend"));
  const placeName = (id: string | null) => places.find((p) => p.id === id)?.name;

  return (
    <div className="flex flex-col gap-4">
      <SubHeader
        emoji="📷"
        title="Photos"
        action={
          !adding ? (
            <Button onClick={() => setAdding(true)} className="px-4 py-2 text-sm">
              Add
            </Button>
          ) : null
        }
      />
      {adding && <Uploader uid={uid} places={places} onDone={() => setAdding(false)} />}
      {editing && <EditSheet memory={editing} places={places} onDone={() => setEditing(null)} />}
      {ready && items.length === 0 && !adding && <Card className="py-8 text-center text-muted">No photos yet — add the first one?</Card>}

      {months.map((g) => (
        <section key={g.key} className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-muted">{g.label}</h2>
          <div className="columns-2 gap-2 [column-fill:_balance]">
            {g.items.map((m) => (
              <button key={m.id} type="button" onClick={() => setViewing(m)} aria-label={m.caption || "Photo"} className="mb-2 block w-full break-inside-avoid overflow-hidden rounded-2xl bg-surface-2">
                <Image src={thumbUrl(m.url)} alt={m.caption} width={m.w} height={m.h} unoptimized className="h-auto w-full" style={{ aspectRatio: `${m.w} / ${m.h}` }} />
              </button>
            ))}
          </div>
        </section>
      ))}
      {hasMore && (
        <Button variant="soft" onClick={loadMore} disabled={loadingMore} className="self-center">
          {loadingMore ? "Loading…" : "Load older"}
        </Button>
      )}

      <ImageViewer
        src={viewing?.url ?? null}
        caption={viewing?.caption}
        meta={viewing ? [`Added by ${nameOf(viewing.uploaderId)}`, format(viewing.takenAt.toDate(), "d MMM yyyy"), placeName(viewing.placeId)].filter(Boolean).join(" · ") : undefined}
        actions={
          viewing && viewing.uploaderId === uid ? (
            <>
              <ViewerButton onClick={() => { setEditing(viewing); setViewing(null); }}>Edit</ViewerButton>
              <ViewerButton
                danger
                onClick={() => {
                  const target = viewing;
                  setViewing(null);
                  void deleteViaServer("memory", target.id).catch(() => undefined);
                }}
              >
                Delete
              </ViewerButton>
            </>
          ) : undefined
        }
        onClose={() => setViewing(null)}
      />
    </div>
  );
}

export function ViewerButton({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`tap rounded-full px-4 py-2 text-sm font-bold ${danger ? "bg-red-500/80 text-white" : "bg-white/20 text-white"}`}>
      {children}
    </button>
  );
}

function PlaceSelect({ value, onChange, places }: { value: string | null; onChange: (v: string | null) => void; places: Place[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="mem-place">Place (optional)</Label>
      <select id="mem-place" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className="tap w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-base">
        <option value="">None</option>
        {places.map((p) => (
          <option key={p.id} value={p.id}>
            {p.kind === "been" ? "🟢" : "🟣"} {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function Uploader({ uid, places, onDone }: { uid: string; places: Place[]; onDone: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [caption, setCaption] = useState("");
  const [date, setDate] = useState(() => toDateInput(new Date()));
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canSave = files.length > 0 && date.length === 10 && progress === null;

  async function save() {
    if (!canSave) return;
    setError(null);
    setProgress(0);
    try {
      const items = await uploadImages(files, setProgress);
      const takenAt = new Date(`${date}T12:00:00`);
      await addMemories(uid, items, caption, takenAt, placeId);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload. Try again?");
    } finally {
      setProgress(null);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <PhotoPicker files={files} onChange={setFiles} max={10} label="Pick photos" />
      <Input value={caption} onChange={(e) => setCaption(e.target.value.slice(0, 300))} placeholder="Caption (optional)" aria-label="Caption" />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mem-date">Taken on</Label>
        <Input id="mem-date" type="date" value={date} max="9999-12-31" onChange={(e) => setDate(e.target.value)} />
      </div>
      <PlaceSelect value={placeId} onChange={setPlaceId} places={places} />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone} disabled={progress !== null}>
          Cancel
        </Button>
        <Button onClick={save} disabled={!canSave} className="px-5">
          {progress !== null ? `Uploading ${Math.round(progress * 100)}%` : `Add ${files.length || ""}`.trim()}
        </Button>
      </div>
    </Card>
  );
}

function EditSheet({ memory, places, onDone }: { memory: Memory; places: Place[]; onDone: () => void }) {
  const [caption, setCaption] = useState(memory.caption);
  const [date, setDate] = useState(() => toDateInput(memory.takenAt.toDate()));
  const [placeId, setPlaceId] = useState<string | null>(memory.placeId);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await editMemory(memory.id, { caption, takenAt: new Date(`${date}T12:00:00`), placeId });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Image src={thumbUrl(memory.url)} alt="" width={56} height={56} unoptimized className="size-14 rounded-xl object-cover" />
        <p className="font-semibold">Edit photo</p>
      </div>
      <Input value={caption} onChange={(e) => setCaption(e.target.value.slice(0, 300))} placeholder="Caption" aria-label="Caption" />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-date">Taken on</Label>
        <Input id="edit-date" type="date" value={date} max="9999-12-31" onChange={(e) => setDate(e.target.value)} />
      </div>
      <PlaceSelect value={placeId} onChange={setPlaceId} places={places} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={save} disabled={busy || date.length !== 10} className="px-5">
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </Card>
  );
}
