"use client";

import { Reorder, useDragControls } from "framer-motion";
import { GripVertical } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { HowToButton } from "@/components/ui/HowTo";
import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import { usePair } from "@/hooks/usePair";
import { cn } from "@/lib/cn";
import { resetHomeCards, setHomeCards } from "@/lib/db/users";
import { HOME_CARDS, isDefaultHomeLayout, normalizeHomeCards, setHomeCardHidden, type HomeCardId } from "@/lib/homeCards";
import { swallow } from "@/lib/swallow";

const LABELS = new Map(HOME_CARDS.map((c) => [c.id, c]));

/** More → Home layout: drag to reorder the Home cards, switch any off, reset. Saved on `users/{me}.homeCards`. */
export function HomeLayoutCard() {
  const { uid, me } = usePair();
  const [open, setOpen] = useState(false);
  const { hidden } = normalizeHomeCards(me.homeCards);
  const summary = isDefaultHomeLayout(me.homeCards) ? "Default order, every card shown" : `Your order${hidden.length ? ` · ${hidden.length} hidden` : ""}`;

  return (
    <Card className="flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-xl" aria-hidden>
        🏠
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold">Home layout</h2>
        <p className="text-sm text-muted">{summary}</p>
      </div>
      <HowToButton topic="homeLayout" autoOpen={false} />
      <Button variant="soft" onClick={() => setOpen(true)} className="shrink-0 px-4 py-2 text-sm">
        Arrange
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} label="Home layout" className="flex flex-col gap-3 px-4" maxHeight="90dvh">
        <LayoutEditor uid={uid} pref={me.homeCards} />
      </Sheet>
    </Card>
  );
}

function LayoutEditor({ uid, pref }: { uid: string; pref: Parameters<typeof normalizeHomeCards>[0] }) {
  const normalized = normalizeHomeCards(pref);
  const [order, setOrder] = useState<HomeCardId[]>(normalized.order);
  const dragging = useRef(false);
  const serverOrder = normalized.order.join(",");
  useEffect(() => {
    if (!dragging.current) setOrder(serverOrder.split(",") as HomeCardId[]);
  }, [serverOrder]);
  const hidden = new Set(normalized.hidden);

  return (
    <>
      <div className="flex items-start justify-between gap-3 px-1">
        <div>
          <h2 className="font-heading text-xl font-semibold">Home layout</h2>
          <p className="text-xs text-muted">Drag to reorder, switch a card off to hide it. 📸 Snap time and 🎲 your move always jump to the top.</p>
        </div>
        <Button variant="ghost" onClick={() => void resetHomeCards(uid).catch(swallow)} disabled={isDefaultHomeLayout(pref)} className="shrink-0 px-3 py-2 text-xs">
          Reset to default
        </Button>
      </div>
      <Reorder.Group axis="y" values={order} onReorder={setOrder} className="flex flex-col gap-1.5">
        {order.map((id) => (
          <Row
            key={id}
            id={id}
            shown={!hidden.has(id)}
            onToggle={(shown) => void setHomeCards(uid, setHomeCardHidden({ order, hidden: normalized.hidden }, id, !shown)).catch(swallow)}
            onDragStart={() => (dragging.current = true)}
            onDrop={() => {
              dragging.current = false;
              void setHomeCards(uid, { order, hidden: normalized.hidden }).catch(swallow);
            }}
          />
        ))}
      </Reorder.Group>
    </>
  );
}

function Row({ id, shown, onToggle, onDragStart, onDrop }: { id: HomeCardId; shown: boolean; onToggle: (shown: boolean) => void; onDragStart: () => void; onDrop: () => void }) {
  const controls = useDragControls();
  const card = LABELS.get(id);
  return (
    <Reorder.Item value={id} dragListener={false} dragControls={controls} onDragStart={onDragStart} onDragEnd={onDrop} className={cn("flex items-center gap-2 rounded-2xl bg-surface-2 py-1.5 pr-3 pl-1", !shown && "opacity-60")}>
      <button type="button" onPointerDown={(e) => controls.start(e)} aria-label={`Drag ${card?.label ?? id}`} className="tap grid w-9 shrink-0 cursor-grab place-items-center text-muted touch-none active:cursor-grabbing">
        <GripVertical size={16} />
      </button>
      <span className="text-xl" aria-hidden>
        {card?.emoji}
      </span>
      <label htmlFor={`home-card-${id}`} className="min-w-0 flex-1 truncate text-sm font-semibold">
        {card?.label ?? id}
      </label>
      <Switch id={`home-card-${id}`} checked={shown} onChange={onToggle} aria-label={`Show ${card?.label ?? id}`} />
    </Reorder.Item>
  );
}
