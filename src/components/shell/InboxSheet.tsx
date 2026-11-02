"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { m, type PanInfo } from "framer-motion";
import { CheckCheck } from "lucide-react";
import Link from "next/link";
import { useCallback } from "react";

import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { usePagedCollection } from "@/hooks/usePagedCollection";
import { cn } from "@/lib/cn";
import { deleteInboxItem, inboxQuery } from "@/lib/db/inbox";
import type { QueryDocumentSnapshot } from "@/lib/firebase/fs";
import { haptic } from "@/lib/haptics";
import { INBOX_EMOJI, INBOX_PAGE, inboxItemUnread } from "@/lib/inbox";
import { swallow } from "@/lib/swallow";
import type { InboxItemDoc } from "@/lib/types";

const SWIPE_DELETE_PX = 80;

interface InboxItem extends InboxItemDoc {
  id: string;
}
const mapDoc = (d: QueryDocumentSnapshot<InboxItemDoc>): InboxItem => ({ id: d.id, ...d.data() });
const ms = (i: InboxItem) => i.createdAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;
const newestFirst = (a: InboxItem, b: InboxItem) => ms(b) - ms(a);

interface InboxSheetProps {
  open: boolean;
  uid: string;
  /** `lastReadAt` (ms) as it was when the sheet opened: rows newer than it are unread. */
  since: number;
  onClose: () => void;
  onMarkAll: () => void;
}

/**
 * The notifications overlay (phase 28): the shared Sheet at 90 % height,
 * drag the grabber (or tap the scrim, or Escape) to dismiss. It is a portal,
 * so the page beneath keeps its scroll position. The list is one bounded
 * listener on the newest 30 rows while open, "Load older" pages one-shot.
 */
export function InboxSheet({ open, uid, since, onClose, onMarkAll }: InboxSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} label="Notifications" height="90dvh" maxHeight="90dvh" dragToClose className="flex flex-col gap-2 px-4">
      <InboxList uid={uid} since={since} onClose={onClose} onMarkAll={onMarkAll} />
    </Sheet>
  );
}

function InboxList({ uid, since, onClose, onMarkAll }: Omit<InboxSheetProps, "open">) {
  const makeQuery = useCallback((after: QueryDocumentSnapshot<InboxItemDoc> | null) => inboxQuery(uid, after), [uid]);
  const { items, ready, hasMore, loadingMore, loadMore } = usePagedCollection(makeQuery, INBOX_PAGE, mapDoc, newestFirst);
  const unreadCount = items.filter((i) => inboxItemUnread(i, since)).length;

  function remove(id: string) {
    haptic("tap");
    deleteInboxItem(uid, id).catch(swallow);
  }

  return (
    <>
      <div className="sticky top-0 z-10 -mx-4 flex items-center gap-2 bg-surface px-4 pb-2">
        <h2 className="flex-1 font-heading text-xl font-semibold">Notifications</h2>
        <button
          type="button"
          onClick={onMarkAll}
          disabled={unreadCount === 0}
          className="tap inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-[var(--accent)] disabled:opacity-40"
        >
          <CheckCheck size={16} aria-hidden /> Mark all read
        </button>
      </div>
      {!ready && <ListSkeleton rows={4} />}
      {ready && items.length === 0 && (
        <p className="rounded-[24px] bg-surface-2 px-5 py-8 text-center text-muted">🔔 Nothing yet — when something happens while you&apos;re away, it lands here.</p>
      )}
      {items.length > 0 && (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <InboxRow key={item.id} item={item} unread={inboxItemUnread(item, since)} onOpen={onClose} onDelete={() => remove(item.id)} />
          ))}
        </ul>
      )}
      {hasMore && (
        <Button variant="soft" onClick={loadMore} disabled={loadingMore} className="mt-2 self-center">
          {loadingMore ? "Loading…" : "Load older"}
        </Button>
      )}
    </>
  );
}

function InboxRow({ item, unread, onOpen, onDelete }: { item: InboxItem; unread: boolean; onOpen: () => void; onDelete: () => void }) {
  const when = item.createdAt ? formatDistanceToNowStrict(item.createdAt.toDate(), { addSuffix: true }) : "just now";
  return (
    <li className="relative overflow-hidden rounded-2xl">
      <div aria-hidden className="absolute inset-0 flex items-center justify-end rounded-2xl bg-rose-500/15 pr-4 text-sm font-semibold text-rose-600">
        Delete
      </div>
      {/* Swipe left to delete; the row snaps back otherwise. */}
      <m.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.6, right: 0 }}
        dragSnapToOrigin
        onDragEnd={(_: unknown, info: PanInfo) => info.offset.x < -SWIPE_DELETE_PX && onDelete()}
        className="relative rounded-2xl bg-surface"
      >
        <Link href={item.url} onClick={onOpen} draggable={false} className={cn("tap flex items-start gap-3 rounded-2xl px-2 py-3 hover:bg-surface-2", unread && "bg-accent-soft/40")}>
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-lg" aria-hidden>
            {INBOX_EMOJI[item.type] ?? "🔔"}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-baseline gap-2">
              <span className={cn("min-w-0 truncate text-[15px]", unread ? "font-bold" : "font-semibold")}>{item.title}</span>
              {item.count > 1 && <span className="shrink-0 rounded-full bg-surface-2 px-1.5 text-[11px] font-bold text-muted">×{item.count}</span>}
              <span className="ml-auto shrink-0 text-xs text-muted">{when}</span>
            </span>
            <span className={cn("line-clamp-2 text-sm leading-snug", unread ? "text-text" : "text-muted")}>{item.body}</span>
          </span>
          {unread && <span className="mt-2 size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
        </Link>
      </m.div>
      <button type="button" onClick={onDelete} className="sr-only">
        Delete notification: {item.title}
      </button>
    </li>
  );
}
