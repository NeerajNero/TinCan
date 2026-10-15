"use client";

import { format } from "date-fns";
import { onSnapshot, type QueryDocumentSnapshot } from "firebase/firestore";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { ImageViewer } from "@/components/chat/media/ImageViewer";
import type { HomePin, MapPin } from "@/components/memories/map/MemoryMap";
import { SubHeader } from "@/components/memories/SubHeader";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { usePair } from "@/hooks/usePair";
import { cn } from "@/lib/cn";
import { thumbUrl } from "@/lib/cloudinary";
import { memoriesAtPlace } from "@/lib/db/memories";
import { addPlace, deletePlace, editPlace, placesQuery, type PlaceInput } from "@/lib/db/places";
import { dateKeyToLocalDate, isDateKey } from "@/lib/dates";
import { searchCities, type CityResult } from "@/lib/geocode";
import type { MemoryDoc, PlaceDoc, PlaceKind } from "@/lib/types";

const MemoryMap = dynamic(() => import("@/components/memories/map/MemoryMap"), {
  ssr: false,
  loading: () => <div className="grid h-full w-full place-items-center rounded-[20px] bg-surface-2 text-sm text-muted">Unrolling the map…</div>,
});

type Draft = { id: string | null } & PlaceInput;
const mapPlace = (d: QueryDocumentSnapshot<PlaceDoc>): MapPin => ({ id: d.id, ...d.data() });

export function MapScreen() {
  const { uid, me, friend } = usePair();
  const [pins, setPins] = useState<MapPin[]>([]);
  const [selected, setSelected] = useState<MapPin | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CityResult[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(placesQuery(), (snap) => setPins(snap.docs.map(mapPlace)));
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const t = setTimeout(() => {
      searchCities(q, controller.signal)
        .then(setResults)
        .catch(() => undefined);
    }, 300);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  const homes = useMemo<HomePin[]>(() => {
    const list: HomePin[] = [{ uid, name: me.nickname, lat: me.lat, lng: me.lng }];
    if (friend) list.push({ uid: "friend", name: friend.nickname, lat: friend.lat, lng: friend.lng });
    return list;
  }, [uid, me, friend]);

  function startDraft(lat: number, lng: number, name = "") {
    setSelected(null);
    setDraft({ id: null, name, lat, lng, kind: "been", note: "", visitedAt: null });
    setFocus({ lat, lng });
  }

  function pickResult(r: CityResult) {
    setQuery("");
    setResults([]);
    startDraft(r.lat, r.lng, r.city);
  }

  return (
    <div className="-mb-6 flex min-h-0 flex-1 flex-col gap-3">
      <SubHeader emoji="🗺️" title="Map" />
      <div className="relative">
        <Search size={18} aria-hidden className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim().length < 2) setResults([]);
          }}
          placeholder="Search a place to add"
          aria-label="Search places"
          className="pl-11"
        />
        {results.length > 0 && (
          <ul className="card absolute inset-x-0 top-full z-[500] mt-1 divide-y divide-border overflow-hidden p-0">
            {results.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => pickResult(r)} className="tap flex w-full flex-col items-start px-4 py-2 text-left hover:bg-surface-2">
                  <span className="font-semibold">{r.city}</span>
                  <span className="text-xs text-muted">{r.region}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="relative min-h-[380px] flex-1 overflow-hidden rounded-[20px]">
        <MemoryMap pins={pins} homes={homes} focus={focus} onLongPress={(lat, lng) => startDraft(lat, lng)} onPinTap={(p) => { setDraft(null); setSelected(p); }} />
      </div>
      <p className="px-1 text-center text-xs text-muted">🟢 been · 🟣 want to go · 🏠 home. Hold the map to add a place.</p>

      <AnimatePresence>
        {draft && <PlaceForm key={draft.id ?? "new"} draft={draft} uid={uid} onClose={() => setDraft(null)} />}
        {selected && !draft && (
          <PlaceSheet
            key={selected.id}
            pin={selected}
            uid={uid}
            me={me.nickname}
            friend={friend?.nickname ?? "Friend"}
            onEdit={() => {
              setDraft({ id: selected.id, name: selected.name, lat: selected.lat, lng: selected.lng, kind: selected.kind, note: selected.note, visitedAt: selected.visitedAt });
              setSelected(null);
            }}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Sheet({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label: string }) {
  return (
    <>
      <motion.button type="button" aria-label="Close" onClick={onClose} className="fixed inset-0 z-[600] bg-black/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.div
        role="dialog"
        aria-label={label}
        className="fixed inset-x-0 bottom-0 z-[601] mx-auto flex max-h-[80dvh] w-full max-w-[480px] flex-col gap-3 overflow-y-auto rounded-t-[28px] bg-surface p-4 pb-[max(env(safe-area-inset-bottom),16px)] shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.3)]"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 420, damping: 38 }}
      >
        <div className="mx-auto h-1.5 w-10 rounded-full bg-border" aria-hidden />
        {children}
      </motion.div>
    </>
  );
}

function PlaceForm({ draft, uid, onClose }: { draft: Draft; uid: string; onClose: () => void }) {
  const [name, setName] = useState(draft.name);
  const [kind, setKind] = useState<PlaceKind>(draft.kind);
  const [note, setNote] = useState(draft.note);
  const [visitedAt, setVisitedAt] = useState(draft.visitedAt ?? "");
  const [busy, setBusy] = useState(false);
  const canSave = name.trim().length > 0 && !busy && (visitedAt === "" || isDateKey(visitedAt));

  async function save() {
    if (!canSave) return;
    setBusy(true);
    try {
      const input: PlaceInput = { name, lat: draft.lat, lng: draft.lng, kind, note, visitedAt: visitedAt || null };
      if (draft.id) await editPlace(draft.id, input);
      else await addPlace(uid, input);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet onClose={onClose} label={draft.id ? "Edit place" : "Add place"}>
      <h2 className="text-lg font-semibold">{draft.id ? "Edit place" : "New place"}</h2>
      <Input value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} placeholder="Name" aria-label="Place name" autoFocus />
      <div role="radiogroup" aria-label="Kind" className="flex gap-2">
        {(["been", "want"] as const).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={cn("tap flex-1 rounded-full px-3 py-2 text-sm font-bold", kind === k ? "bg-[var(--accent)] text-white" : "bg-surface-2 text-muted")}>
            {k === "been" ? "🟢 Been there" : "🟣 Want to go"}
          </button>
        ))}
      </div>
      <Input value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} placeholder="A note (optional)" aria-label="Note" />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="place-date">{kind === "been" ? "Visited on" : "Planned for"} (optional)</Label>
        <Input id="place-date" type="date" value={visitedAt} max="9999-12-31" onChange={(e) => setVisitedAt(e.target.value)} />
      </div>
      <p className="text-xs text-muted">
        {draft.lat.toFixed(3)}, {draft.lng.toFixed(3)}
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={save} disabled={!canSave} className="px-5">
          {busy ? "Saving…" : draft.id ? "Save" : "Add pin"}
        </Button>
      </div>
    </Sheet>
  );
}

function PlaceSheet({ pin, uid, me, friend, onEdit, onClose }: { pin: MapPin; uid: string; me: string; friend: string; onEdit: () => void; onClose: () => void }) {
  const [photos, setPhotos] = useState<Array<MemoryDoc & { id: string }>>([]);
  const [viewing, setViewing] = useState<(MemoryDoc & { id: string }) | null>(null);
  useEffect(() => {
    const unsub = onSnapshot(memoriesAtPlace(pin.id), (snap) => setPhotos(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [pin.id]);

  return (
    <Sheet onClose={onClose} label={pin.name}>
      <div className="flex items-start gap-3">
        <span className="text-3xl" aria-hidden>
          {pin.kind === "been" ? "🟢" : "🟣"}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-tight">{pin.name}</h2>
          <p className="text-xs text-muted">
            {pin.kind === "been" ? "Been there" : "Want to go"}
            {pin.visitedAt && isDateKey(pin.visitedAt) && ` · ${format(dateKeyToLocalDate(pin.visitedAt), "d MMM yyyy")}`}
            {` · added by ${pin.addedBy === uid ? me : friend}`}
          </p>
          {pin.note && <p className="mt-1 text-sm">{pin.note}</p>}
        </div>
        <button type="button" onClick={() => void deletePlace(pin.id).then(onClose)} aria-label="Delete place" className="tap grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2">
          <Trash2 size={16} />
        </button>
      </div>
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-1">
          {photos.map((p) => (
            <button key={p.id} type="button" onClick={() => setViewing(p)} aria-label={p.caption || "Photo"} className="overflow-hidden rounded-xl bg-surface-2">
              <Image src={thumbUrl(p.url)} alt="" width={120} height={120} unoptimized className="h-24 w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="soft" onClick={onEdit}>
          Edit
        </Button>
        <Button onClick={onClose}>Done</Button>
      </div>
      <ImageViewer src={viewing?.url ?? null} caption={viewing?.caption} onClose={() => setViewing(null)} />
    </Sheet>
  );
}
