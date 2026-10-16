"use client";

import { format } from "date-fns";
import { AnimatePresence, m } from "framer-motion";
import { useEffect, useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { usePair } from "@/hooks/usePair";
import { addJarNote, drawJarNote, jarByMe, jarForMe } from "@/lib/db/jar";
import { onSnapshot, type QueryDocumentSnapshot } from "@/lib/firebase/fs";
import { notify } from "@/lib/notify";
import type { JarDoc } from "@/lib/types";

interface Note extends JarDoc {
  id: string;
}
const mapDoc = (d: QueryDocumentSnapshot<JarDoc>): Note => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) });
const byDrawnDesc = (a: Note, b: Note) => (b.drawnAt?.toMillis() ?? 0) - (a.drawnAt?.toMillis() ?? 0);

export function JarScreen() {
  const { uid, friend, friendUid } = usePair();
  const [forMe, setForMe] = useState<Note[]>([]);
  const [byMe, setByMe] = useState<Note[]>([]);
  const [drawn, setDrawn] = useState<Note | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const a = onSnapshot(jarForMe(uid), (snap) => setForMe(snap.docs.map(mapDoc)));
    const b = onSnapshot(jarByMe(uid), (snap) => setByMe(snap.docs.map(mapDoc)));
    return () => {
      a();
      b();
    };
  }, [uid]);

  const undrawn = forMe.filter((n) => !n.drawnAt).length;
  const drawnList = forMe.filter((n) => n.drawnAt).sort(byDrawnDesc);
  const friendName = friend?.nickname ?? "your friend";

  async function draw() {
    if (drawing || undrawn === 0) return;
    setDrawing(true);
    setDrawn(null);
    try {
      await new Promise((r) => setTimeout(r, 600));
      setDrawn(await drawJarNote(uid));
    } finally {
      setDrawing(false);
    }
  }

  async function add() {
    const t = text.trim();
    if (!t || !friendUid || adding) return;
    setAdding(true);
    try {
      await addJarNote(uid, friendUid, t);
      setText("");
      void notify("jar", { toUid: friendUid });
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SubHeader emoji="🫙" title="Jar" />

      <Card className="flex flex-col items-center gap-3 py-6 text-center">
        <m.span className="text-7xl" aria-hidden animate={drawing ? { rotate: [0, -12, 12, -8, 8, 0] } : { rotate: 0 }} transition={{ duration: 0.6 }}>
          🫙
        </m.span>
        <p className="font-heading text-lg font-semibold">
          {undrawn === 0 ? "Your jar is empty" : `${undrawn} ${undrawn === 1 ? "note" : "notes"} from ${friendName}`}
        </p>
        <Button onClick={draw} disabled={drawing || undrawn === 0} className="px-6">
          {drawing ? "Fishing one out…" : "Draw one"}
        </Button>
        <AnimatePresence>
          {drawn && (
            <m.blockquote
              key={drawn.id}
              initial={{ opacity: 0, scale: 0.8, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
              className="w-full rounded-2xl bg-accent-soft px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap"
            >
              “{drawn.text}”
            </m.blockquote>
          )}
        </AnimatePresence>
      </Card>

      {friendUid && (
        <Card className="flex flex-col gap-2">
          <p className="text-sm font-bold">Drop a note in {friendName}&apos;s jar</p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
          >
            <Input value={text} onChange={(e) => setText(e.target.value.slice(0, 500))} placeholder="Something small and kind" aria-label="Note" />
            <Button type="submit" disabled={!text.trim() || adding} className="shrink-0 px-4">
              {adding ? "…" : "Add"}
            </Button>
          </form>
          <p className="text-xs text-muted">{byMe.filter((n) => !n.drawnAt).length} waiting · {byMe.filter((n) => n.drawnAt).length} drawn</p>
        </Card>
      )}

      {drawnList.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-muted">Drawn so far</h2>
          {drawnList.map((n) => (
            <Card key={n.id} className="flex flex-col gap-1 px-4 py-3">
              <p className="text-[15px] whitespace-pre-wrap">{n.text}</p>
              <p className="text-xs text-muted">Drawn {n.drawnAt ? format(n.drawnAt.toDate(), "d MMM yyyy") : ""}</p>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
