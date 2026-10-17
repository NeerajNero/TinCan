"use client";

import { m, Reorder, useDragControls, type PanInfo } from "framer-motion";
import { GripVertical, ListPlus, MoreVertical, Play, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Sheet, useStickyValue } from "@/components/ui/Sheet";
import { usePair } from "@/hooks/usePair";
import { cn } from "@/lib/cn";
import { playlistThumb, type PlaylistItem } from "@/lib/playlist";

const SWIPE_REMOVE_PX = 90;

export interface PlaylistRowsProps {
  items: PlaylistItem[];
  currentVideoId: string | null;
  onPlay: (item: PlaylistItem) => void;
  onRemove: (videoId: string) => void;
  onMove: (videoId: string, to: number) => void;
  onQueue?: (item: PlaylistItem) => void;
  queuedIds?: ReadonlySet<string>;
}

/**
 * The open playlist: draggable rows plus the ⋮ menu. Loaded only when the
 * section is opened, because `Reorder` brings framer-motion's layout runtime.
 */
export function PlaylistRows({ items, currentVideoId, onPlay, onRemove, onMove, onQueue, queuedIds }: PlaylistRowsProps) {
  const [menuFor, setMenuFor] = useState<PlaylistItem | null>(null);
  const menuItem = useStickyValue(menuFor);
  const { uid, me, friend } = usePair();

  // Local order while dragging; follows the server otherwise.
  const [order, setOrder] = useState<string[]>([]);
  const dragging = useRef(false);
  const serverOrder = items.map((i) => i.videoId).join(",");
  useEffect(() => {
    if (!dragging.current) setOrder(serverOrder ? serverOrder.split(",") : []);
  }, [serverOrder]);
  const byId = new Map(items.map((i) => [i.videoId, i]));
  const rows = order.map((id) => byId.get(id)).filter((i): i is PlaylistItem => Boolean(i));

  return (
    <>
      <Reorder.Group axis="y" values={order} onReorder={setOrder} className="flex flex-col gap-2">
        {rows.map((item) => (
          <Row
            key={item.videoId}
            item={item}
            playing={item.videoId === currentVideoId}
            who={item.addedBy === uid ? me : friend}
            onPlay={() => onPlay(item)}
            onQueue={onQueue && !queuedIds?.has(item.videoId) ? () => onQueue(item) : undefined}
            onRemove={() => onRemove(item.videoId)}
            onMenu={() => setMenuFor(item)}
            onDragStart={() => (dragging.current = true)}
            onDrop={() => {
              dragging.current = false;
              onMove(item.videoId, order.indexOf(item.videoId));
            }}
          />
        ))}
      </Reorder.Group>
      <Sheet open={menuFor !== null} onClose={() => setMenuFor(null)} label="Playlist item" className="gap-1 px-3">
        {menuItem && (
          <>
            <p className="line-clamp-2 px-2 pb-2 text-sm font-semibold">{menuItem.title}</p>
            <MenuButton icon={<Play size={18} />} label="Play now" onClick={() => (onPlay(menuItem), setMenuFor(null))} />
            {onQueue && !queuedIds?.has(menuItem.videoId) && <MenuButton icon={<ListPlus size={18} />} label="Add to queue" onClick={() => (onQueue(menuItem), setMenuFor(null))} />}
            <MenuButton icon={<Trash2 size={18} />} label="Remove from playlist" danger onClick={() => (onRemove(menuItem.videoId), setMenuFor(null))} />
          </>
        )}
      </Sheet>
    </>
  );
}

function MenuButton({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn("tap flex items-center gap-3 rounded-2xl px-3 text-left font-semibold hover:bg-surface-2", danger && "text-red-500")}>
      {icon}
      {label}
    </button>
  );
}

interface RowProps {
  item: PlaylistItem;
  playing: boolean;
  who: Parameters<typeof Avatar>[0]["user"] | null;
  onPlay: () => void;
  onQueue?: () => void;
  onRemove: () => void;
  onMenu: () => void;
  onDragStart: () => void;
  onDrop: () => void;
}

function Row({ item, playing, who, onPlay, onQueue, onRemove, onMenu, onDragStart, onDrop }: RowProps) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={item.videoId} dragListener={false} dragControls={controls} onDragStart={onDragStart} onDragEnd={onDrop} className={cn("card flex items-center gap-1 rounded-[20px] py-1.5 pr-1 pl-1", playing && "border-[var(--accent)] bg-accent-soft")}>
      <button type="button" onPointerDown={(e) => controls.start(e)} aria-label="Drag to reorder" className="tap grid w-8 shrink-0 cursor-grab place-items-center text-muted touch-none active:cursor-grabbing">
        <GripVertical size={16} />
      </button>
      {/* Swipe left to remove; the drag handle sits outside so the two gestures never mix. */}
      <m.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.6, right: 0 }}
        dragSnapToOrigin
        onDragEnd={(_: unknown, info: PanInfo) => info.offset.x < -SWIPE_REMOVE_PX && onRemove()}
        className="flex min-w-0 flex-1 items-center gap-2"
      >
        <button type="button" onClick={onPlay} aria-label={`Play ${item.title}`} className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 text-left">
          {/* eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail */}
          <img src={playlistThumb(item.videoId)} alt="" width={64} height={36} loading="lazy" decoding="async" className="h-9 w-16 shrink-0 rounded-lg bg-surface-2 object-cover" />
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 text-sm leading-snug font-semibold">{item.title}</span>
            {playing && <span className="text-[11px] font-bold text-[var(--accent)]">Now playing</span>}
          </span>
        </button>
        {who && <Avatar user={who} size={20} />}
        {onQueue && (
          <button type="button" onClick={onQueue} aria-label="Add to queue" className="tap flex shrink-0 items-center rounded-full px-2 text-xs font-bold text-muted hover:bg-surface-2">
            + Queue
          </button>
        )}
        <button type="button" onClick={onMenu} aria-label="More" className="tap grid w-9 shrink-0 place-items-center rounded-full text-muted">
          <MoreVertical size={16} />
        </button>
      </m.div>
    </Reorder.Item>
  );
}
