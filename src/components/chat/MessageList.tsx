"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { UploadBubble } from "@/components/chat/media/UploadBubble";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ListSkeleton } from "@/components/ui/Skeleton";
import type { Upload } from "@/hooks/useUploads";
import { AUTO_LOAD_PAGES } from "@/hooks/useMessages";
import { cn } from "@/lib/cn";
import { dateKeyIn, dateKeyToLocalDate, previousDay } from "@/lib/dates";
import { format } from "date-fns";
import type { Message } from "@/lib/types";

const NEAR_BOTTOM_PX = 120;
const LOAD_OLDER_PX = 80;

interface MessageListProps {
  messages: Message[];
  ready: boolean;
  hasMore: boolean;
  loadingOlder: boolean;
  pageCount: number;
  loadOlder: () => void;
  prune: () => boolean;
  uid: string;
  tz: string;
  friendName: string;
  /** Ids of incoming messages unread when the screen opened. */
  initialUnread: Set<string>;
  onOpenMenu: (m: Message) => void;
  onReply: (m: Message) => void;
  onReact: (m: Message, emoji: string) => void;
  onOpenImage: (m: Message) => void;
  deletingIds: Set<string>;
  uploads: Upload[];
  onRetryUpload: (id: string) => void;
  onDismissUpload: (id: string) => void;
  /** Bumped by the parent on visual-viewport resizes and composer focus. */
  layoutTick: number;
}

function dayLabel(key: string, today: string): string {
  if (key === today) return "Today";
  if (key === previousDay(today)) return "Yesterday";
  return format(dateKeyToLocalDate(key), "EEE, d MMM yyyy");
}

export function MessageList(props: MessageListProps) {
  const { messages, ready, hasMore, loadingOlder, pageCount, loadOlder, prune, uid, tz, friendName, initialUnread, onOpenMenu, onReply, onReact, onOpenImage, deletingIds, uploads, onRetryUpload, onDismissUpload, layoutTick } = props;
  const scroller = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const didInitialScroll = useRef(false);
  const prepend = useRef<{ height: number; top: number } | null>(null);
  const lastId = useRef<string | null>(null);
  const [fabCount, setFabCount] = useState(0);
  const [awayFromBottom, setAwayFromBottom] = useState(false);

  const visible = messages.filter((m) => !m.deletedFor.includes(uid));
  const today = dateKeyIn(tz);
  const firstUnreadId = visible.find((m) => initialUnread.has(m.id))?.id ?? null;

  function scrollToBottom(behavior: ScrollBehavior = "auto") {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }

  // Initial position: unread divider, else the bottom.
  useLayoutEffect(() => {
    if (!ready || didInitialScroll.current || visible.length === 0) return;
    didInitialScroll.current = true;
    if (firstUnreadId && dividerRef.current) {
      dividerRef.current.scrollIntoView({ block: "start" });
      nearBottom.current = false;
    } else {
      scrollToBottom();
    }
    lastId.current = visible[visible.length - 1]?.id ?? null;
  }, [ready, visible, firstUnreadId]);

  // Keep the viewport steady when older messages are prepended (or pruned away).
  useLayoutEffect(() => {
    const el = scroller.current;
    const p = prepend.current;
    if (!el || !p) return;
    prepend.current = null;
    el.scrollTop = el.scrollHeight - p.height + p.top;
  }, [visible.length]);

  // Keyboard opened/closed or composer focused: if we were at the bottom, stay there (after layout settles).
  useEffect(() => {
    if (layoutTick === 0 || !nearBottom.current) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => scrollToBottom());
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [layoutTick]);

  // An outgoing upload placeholder always brings us to the bottom.
  const uploadCount = uploads.length;
  useEffect(() => {
    if (uploadCount > 0) scrollToBottom("smooth");
  }, [uploadCount]);

  // New message at the end: follow it if we're near the bottom or it's ours; otherwise count it for the FAB.
  useEffect(() => {
    if (!didInitialScroll.current) return;
    const last = visible[visible.length - 1];
    if (!last || last.id === lastId.current) return;
    lastId.current = last.id;
    if (nearBottom.current || last.senderId === uid) {
      scrollToBottom("smooth");
    } else {
      setFabCount((c) => c + 1);
    }
  }, [visible, uid]);

  const autoLoad = pageCount < AUTO_LOAD_PAGES;

  function requestOlder() {
    const el = scroller.current;
    if (!el || !hasMore || loadingOlder) return;
    prepend.current = { height: el.scrollHeight, top: el.scrollTop };
    loadOlder();
  }

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    nearBottom.current = distance < NEAR_BOTTOM_PX;
    setAwayFromBottom(!nearBottom.current);
    if (nearBottom.current) {
      setFabCount(0);
      // Back at the bottom with deep history loaded: let the oldest pages go.
      if (!loadingOlder) {
        const before = { height: el.scrollHeight, top: el.scrollTop };
        if (prune()) prepend.current = before;
      }
    }
    if (autoLoad && el.scrollTop < LOAD_OLDER_PX && didInitialScroll.current) requestOlder();
  }

  const rows: Array<{ m: Message; dayLabel: string | null }> = [];
  for (const m of visible) {
    const day = dateKeyIn(tz, new Date(m.createdAtMs));
    const prev = rows.length ? dateKeyIn(tz, new Date(rows[rows.length - 1].m.createdAtMs)) : null;
    rows.push({ m, dayLabel: day !== prev ? dayLabel(day, today) : null });
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scroller} onScroll={onScroll} className="h-full overflow-y-auto px-3 py-3 [overflow-anchor:none]">
        {loadingOlder && <p className="py-2 text-center text-xs text-muted">Loading older…</p>}
        {ready && hasMore && !loadingOlder && !autoLoad && (
          <div className="flex justify-center py-2">
            <button
              type="button"
              onClick={requestOlder}
              className="tap rounded-full bg-surface px-4 py-2 text-xs font-bold text-muted shadow-sm hover:bg-surface-2"
            >
              Load older messages
            </button>
          </div>
        )}
        {ready && !hasMore && visible.length > 0 && (
          <p className="py-2 text-center text-xs text-muted">This is where it all began 🥫</p>
        )}
        {!ready && <ListSkeleton rows={4} />}
        {ready && visible.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <span className="text-5xl" aria-hidden>
              🥫
            </span>
            <p className="text-muted">No messages yet — say hi to {friendName}?</p>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          {rows.map(({ m, dayLabel: label }) => {
            return (
              <div key={m.id} className="flex flex-col gap-1.5">
                {label && <Separator label={label} />}
                {m.id === firstUnreadId && (
                  <div ref={dividerRef} className="scroll-mt-2">
                    <Separator label={`${initialUnread.size} unread ${initialUnread.size === 1 ? "message" : "messages"}`} accent />
                  </div>
                )}
                {m.type === "system" ? (
                  <p className="mx-auto max-w-[90%] rounded-full bg-surface-2 px-3 py-1 text-center text-xs font-semibold text-muted">
                    {m.text}
                  </p>
                ) : (
                  <MessageBubble
                    message={m}
                    mine={m.senderId === uid}
                    uid={uid}
                    tz={tz}
                    friendName={friendName}
                    onOpenMenu={onOpenMenu}
                    onReply={onReply}
                    onReact={onReact}
                    onOpenImage={onOpenImage}
                    deleting={deletingIds.has(m.id)}
                  />
                )}
              </div>
            );
          })}
          {uploads.map((u) => (
            <UploadBubble key={u.id} upload={u} onRetry={() => onRetryUpload(u.id)} onDismiss={() => onDismissUpload(u.id)} />
          ))}
        </div>
      </div>

      <AnimatePresence>
        {(awayFromBottom || fabCount > 0) && (
          <motion.button
            key="fab"
            type="button"
            onClick={() => {
              scrollToBottom("smooth");
              setFabCount(0);
            }}
            aria-label={fabCount > 0 ? `${fabCount} new messages, jump to latest` : "Jump to latest"}
            initial={{ opacity: 0, y: 12, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.8 }}
            className="tap absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-surface px-3 py-2 text-sm font-bold shadow-lg"
          >
            {fabCount > 0 && (
              <span className="min-w-5 rounded-full bg-[var(--accent)] px-1.5 text-center text-xs leading-5 text-white">{fabCount}</span>
            )}
            <ArrowDown size={16} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function Separator({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <div className="my-1 flex items-center gap-3" role="separator" aria-label={label}>
      <span className={cn("h-px flex-1", accent ? "bg-[var(--accent)]/50" : "bg-border")} />
      <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold", accent ? "bg-accent-soft text-text" : "bg-surface-2 text-muted")}>{label}</span>
      <span className={cn("h-px flex-1", accent ? "bg-[var(--accent)]/50" : "bg-border")} />
    </div>
  );
}
