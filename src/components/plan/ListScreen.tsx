"use client";

import { Reorder, useDragControls } from "framer-motion";
import { Check, ChevronDown, GripVertical, Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { Confetti } from "@/components/plan/Confetti";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { usePair } from "@/hooks/usePair";
import { cn } from "@/lib/cn";
import { addItem, deleteItem, editItem, itemsQuery, LIST_META, reorderItems, setDone } from "@/lib/db/lists";
import { onSnapshot, type QueryDocumentSnapshot } from "@/lib/firebase/fs";
import type { ListItemDoc, ListKind } from "@/lib/types";

interface Item extends ListItemDoc {
  id: string;
}
const mapDoc = (d: QueryDocumentSnapshot<ListItemDoc>): Item => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) });

export function ListScreen({ kind }: { kind: ListKind }) {
  const { uid, me, friend } = usePair();
  const [items, setItems] = useState<Item[]>([]);
  const [ready, setReady] = useState(false);
  const [text, setText] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [burst, setBurst] = useState(0);
  const [order, setOrder] = useState<string[] | null>(null);
  const meta = LIST_META[kind];

  useEffect(() => {
    const unsub = onSnapshot(itemsQuery(kind, uid), (snap) => {
      setItems(snap.docs.map(mapDoc).sort((a, b) => a.order - b.order));
      setReady(true);
      setOrder(null);
    });
    return () => {
      unsub();
      setItems([]);
      setReady(false);
    };
  }, [kind, uid]);

  const open = useMemo(() => items.filter((i) => !i.done), [items]);
  const done = useMemo(() => items.filter((i) => i.done).sort((a, b) => (b.doneAt?.toMillis() ?? 0) - (a.doneAt?.toMillis() ?? 0)), [items]);
  const openOrdered = useMemo(() => (order ? order.map((id) => open.find((i) => i.id === id)).filter((i): i is Item => Boolean(i)) : open), [order, open]);

  async function add() {
    const t = text.trim();
    if (!t) return;
    setText("");
    await addItem(kind, uid, t, (items.at(-1)?.order ?? -1) + 1);
  }

  async function toggle(item: Item) {
    const next = !item.done;
    await setDone(kind, item.id, next);
    if (next && kind === "bucket") setBurst((b) => b + 1);
  }

  function commitOrder(ids: string[]) {
    setOrder(ids);
    void reorderItems(kind, ids, new Map(open.map((i) => [i.id, i.order])));
  }

  const whoAdded = (id: string) => (id === uid ? me : friend);

  return (
    <div className="flex flex-col gap-4">
      <SubHeader emoji={meta.emoji} title={kind === "gifts" && friend ? `Gift ideas for ${friend.nickname}` : meta.title} back="/plan" />
      {kind === "gifts" && <p className="-mt-2 px-2 text-xs text-muted">Only you can see this list. {friend?.nickname ?? "They"} keeps their own.</p>}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value.slice(0, 200))} placeholder={kind === "todo" ? "Add a task" : "Add something"} aria-label="New item" />
        <Button type="submit" disabled={!text.trim()} className="shrink-0 px-4">
          Add
        </Button>
      </form>

      {editing && <EditCard item={editing} kind={kind} onDone={() => setEditing(null)} />}

      {!ready && <ListSkeleton />}
      {ready && items.length === 0 && <Card className="py-8 text-center text-muted">Nothing here yet — add the first one?</Card>}

      <Reorder.Group axis="y" values={openOrdered.map((i) => i.id)} onReorder={commitOrder} className="flex flex-col gap-2">
        {openOrdered.map((item) => (
          <Row key={item.id} item={item} who={whoAdded(item.addedBy)} onToggle={() => void toggle(item)} onEdit={() => setEditing(item)} onDelete={() => void deleteItem(kind, item.id)} />
        ))}
      </Reorder.Group>

      {done.length > 0 && (
        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone} className="tap flex items-center gap-2 px-2 text-sm font-bold text-muted">
            <ChevronDown size={16} className={cn("transition-transform", showDone && "rotate-180")} />
            {done.length} done
          </button>
          {showDone &&
            done.map((item) => (
              <div key={item.id} className="card flex items-center gap-3 rounded-[20px] px-3 py-2 opacity-70">
                <button type="button" onClick={() => void toggle(item)} aria-label="Mark not done" className="tap grid size-9 place-items-center rounded-full bg-emerald-400/25 text-emerald-700 dark:text-emerald-300">
                  <Check size={16} />
                </button>
                <span className="min-w-0 flex-1 truncate text-sm line-through">{item.text}</span>
                <button type="button" onClick={() => void deleteItem(kind, item.id)} aria-label="Delete" className="tap grid size-9 place-items-center rounded-full text-muted">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
        </div>
      )}
      <Confetti burst={burst} />
    </div>
  );
}

function Row({ item, who, onToggle, onEdit, onDelete }: { item: Item; who: { photoURL: string | null; avatar?: { url: string; publicId: string } | null } | null; onToggle: () => void; onEdit: () => void; onDelete: () => void }) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={item.id} dragListener={false} dragControls={controls} className="card flex items-center gap-2 rounded-[20px] px-2 py-2">
      <button type="button" onPointerDown={(e) => controls.start(e)} aria-label="Drag to reorder" className="tap grid size-9 shrink-0 cursor-grab place-items-center rounded-full text-muted touch-none active:cursor-grabbing">
        <GripVertical size={16} />
      </button>
      <button type="button" onClick={onToggle} aria-label="Mark done" className="tap grid size-9 shrink-0 place-items-center rounded-full border-2 border-border hover:border-[var(--accent)]" />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-snug">{item.text}</p>
        {(item.note || item.url) && (
          <p className="truncate text-xs text-muted">
            {item.note}
            {item.note && item.url && " · "}
            {item.url && (
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="underline">
                link
              </a>
            )}
          </p>
        )}
      </div>
      {who && <Avatar user={who} size={22} />}
      <button type="button" onClick={onEdit} aria-label="Edit" className="tap grid size-9 shrink-0 place-items-center rounded-full text-muted">
        <Pencil size={14} />
      </button>
      <button type="button" onClick={onDelete} aria-label="Delete" className="tap grid size-9 shrink-0 place-items-center rounded-full text-muted">
        <Trash2 size={14} />
      </button>
    </Reorder.Item>
  );
}

function EditCard({ item, kind, onDone }: { item: Item; kind: ListKind; onDone: () => void }) {
  const [text, setText] = useState(item.text);
  const [note, setNote] = useState(item.note);
  const [url, setUrl] = useState(item.url);
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await editItem(kind, item.id, { text, note, url });
      onDone();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="flex flex-col gap-2">
      <Input value={text} onChange={(e) => setText(e.target.value.slice(0, 200))} aria-label="Text" autoFocus />
      <Input value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} placeholder="Note (optional)" aria-label="Note" />
      <Input value={url} onChange={(e) => setUrl(e.target.value.slice(0, 500))} placeholder="Link (optional)" aria-label="Link" inputMode="url" />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={save} disabled={busy || !text.trim()} className="px-5">
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </Card>
  );
}
