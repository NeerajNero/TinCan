"use client";

import { format } from "date-fns";
import { AnimatePresence, m } from "framer-motion";
import { useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { Card } from "@/components/ui/Card";
import { GARDEN_STICKERS, GardenScene, type GardenSticker } from "@/content/garden";
import { usePair } from "@/hooks/usePair";
import { cn } from "@/lib/cn";

export function GardenScreen() {
  const { uid, me, friend, pair } = usePair();
  const unlocked = pair.garden?.stickers ?? {};
  const [selected, setSelected] = useState<GardenSticker | null>(null);
  const count = GARDEN_STICKERS.filter((s) => unlocked[s.id]).length;
  const nameOf = (id: string) => (id === uid ? me.nickname : (friend?.nickname ?? "Friend"));
  const sel = selected ? unlocked[selected.id] : undefined;

  return (
    <div className="flex flex-col gap-4">
      <SubHeader help="garden" emoji="🌻" title="Garden" />
      <p className="-mt-2 px-2 text-xs text-muted">
        {count}/{GARDEN_STICKERS.length} stickers grown. Do things together and the garden fills up.
      </p>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[24px] border border-border shadow-sm">
        <GardenScene />
        {GARDEN_STICKERS.map((s) => {
          const on = Boolean(unlocked[s.id]);
          return (
            <m.button
              key={s.id}
              type="button"
              onClick={() => setSelected(s)}
              aria-label={on ? s.name : `Locked: ${s.hint}`}
              className={cn("absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-0.5", selected?.id === s.id && "ring-2 ring-[var(--accent)]")}
              style={{ left: `${s.x}%`, top: `${s.y}%` }}
              initial={false}
              animate={on ? { scale: [0, 1.3, 1], rotate: [0, -8, 0] } : { scale: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <s.Svg size={40} locked={!on} />
            </m.button>
          );
        })}
      </div>
      <AnimatePresence mode="wait">
        {selected && (
          <m.div key={selected.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="flex items-center gap-3">
              <selected.Svg size={48} locked={!sel} />
              <div className="min-w-0 flex-1">
                <p className="font-heading font-semibold">{sel ? selected.name : "A silhouette, for now"}</p>
                <p className="text-sm text-muted">{sel ? `Earned by ${nameOf(sel.by)}${sel.at ? ` on ${format(sel.at.toDate(), "d MMM yyyy")}` : ""} · ${selected.hint.toLowerCase()}` : selected.hint}</p>
              </div>
            </Card>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
