"use client";

import { onSnapshot, Timestamp, type Query, type Unsubscribe } from "@/lib/firebase/fs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { latestQuery, olderQuery, PAGE_SIZE, toMessage } from "@/lib/db/messages";
import type { Message, MessageDoc } from "@/lib/types";

/** Pages (including the live one) that scrolling alone may load; beyond this it's a button. */
export const AUTO_LOAD_PAGES = 4;
/** Pages kept once the reader is back near the bottom; older ones are dropped and re-read from cache later. */
export const KEEP_PAGES = 4;

interface Page {
  unsub: Unsubscribe;
  /** Every id this page has ever delivered (so a doc that slides out of its window is kept). */
  ids: Set<string>;
}

interface MessagesState {
  /** Oldest → newest. */
  messages: Message[];
  /** Incoming messages that were unread when the thread opened (for the divider). */
  initialUnread: Set<string>;
  /** First snapshot has arrived. */
  ready: boolean;
  hasMore: boolean;
  loadingOlder: boolean;
  /** Pages currently held, the live one included. */
  pageCount: number;
  loadOlder: () => void;
  /** Drop pages beyond KEEP_PAGES (oldest first). Returns true when something was dropped. */
  prune: () => boolean;
}

/**
 * The live thread: one listener on the latest 50, plus one bounded listener per
 * older page. Documents merge into a map by id and are never dropped when they
 * slide out of a page's window (messages are soft-deleted, never removed), so
 * the list stays contiguous as new messages arrive. Pages are only ever dropped
 * from the old end, so what's held is always the newest N pages in a row.
 */
export function useMessages(uid: string): MessagesState {
  const [map, setMap] = useState<Map<string, Message>>(() => new Map());
  const [initialUnread, setInitialUnread] = useState<Set<string>>(() => new Set());
  const [ready, setReady] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const pages = useRef<Page[]>([]);
  const oldestRef = useRef<Timestamp | null>(null);

  const attach = useCallback((q: Query<MessageDoc>, onFirst: (size: number, docs: Message[]) => void) => {
    let first = true;
    const page: Page = { unsub: () => undefined, ids: new Set() };
    page.unsub = onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
      setMap((prev) => {
        const next = new Map(prev);
        for (const change of snap.docChanges()) {
          if (change.type === "removed") continue; // slid out of the window; keep it
          page.ids.add(change.doc.id);
          next.set(change.doc.id, toMessage(change.doc));
        }
        return next;
      });
      if (first) {
        first = false;
        onFirst(snap.size, snap.docs.map(toMessage));
      }
    });
    pages.current.push(page);
    setPageCount(pages.current.length);
  }, []);

  useEffect(() => {
    const current = pages.current;
    attach(latestQuery(), (size, docs) => {
      setInitialUnread(new Set(docs.filter((m) => m.senderId !== uid && !m.readAt).map((m) => m.id)));
      setReady(true);
      setHasMore(size >= PAGE_SIZE);
    });
    return () => {
      current.forEach((p) => p.unsub());
      current.length = 0;
      setPageCount(0);
      setMap(new Map());
      setInitialUnread(new Set());
      setReady(false);
      setHasMore(false);
    };
  }, [attach, uid]);

  const messages = useMemo(
    () => Array.from(map.values()).sort((a, b) => a.createdAtMs - b.createdAtMs || a.id.localeCompare(b.id)),
    [map],
  );

  // The pagination cursor: the oldest server-acknowledged message we hold.
  useEffect(() => {
    oldestRef.current = messages.find((m) => !m.pending && m.createdAt)?.createdAt ?? null;
  }, [messages]);

  const loadOlder = useCallback(() => {
    const cursor = oldestRef.current;
    if (!cursor || loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    attach(olderQuery(cursor), (size) => {
      setLoadingOlder(false);
      setHasMore(size >= PAGE_SIZE);
    });
  }, [attach, hasMore, loadingOlder]);

  const prune = useCallback((): boolean => {
    if (pages.current.length <= KEEP_PAGES) return false;
    const dropped = pages.current.splice(KEEP_PAGES);
    dropped.forEach((p) => p.unsub());
    const keep = new Set<string>();
    pages.current.forEach((p) => p.ids.forEach((id) => keep.add(id)));
    setMap((prev) => new Map(Array.from(prev).filter(([id]) => keep.has(id))));
    setPageCount(pages.current.length);
    setHasMore(true); // we just let go of older history
    return true;
  }, []);

  return { messages, initialUnread, ready, hasMore, loadingOlder, pageCount, loadOlder, prune };
}
