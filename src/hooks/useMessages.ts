"use client";

import { onSnapshot, Timestamp, type Query, type Unsubscribe } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { latestQuery, olderQuery, PAGE_SIZE, toMessage } from "@/lib/db/messages";
import type { Message, MessageDoc } from "@/lib/types";

interface MessagesState {
  /** Oldest → newest. */
  messages: Message[];
  /** Incoming messages that were unread when the thread opened (for the divider). */
  initialUnread: Set<string>;
  /** First snapshot has arrived. */
  ready: boolean;
  hasMore: boolean;
  loadingOlder: boolean;
  loadOlder: () => void;
}

/**
 * The live thread: one listener on the latest 50, plus one bounded listener per
 * older page. Documents are merged into a map by id and never dropped when they
 * slide out of a page's window (messages are soft-deleted, never removed), so
 * the list stays contiguous as new messages arrive.
 */
export function useMessages(uid: string): MessagesState {
  const [map, setMap] = useState<Map<string, Message>>(() => new Map());
  const [initialUnread, setInitialUnread] = useState<Set<string>>(() => new Set());
  const [ready, setReady] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const pages = useRef<Unsubscribe[]>([]);
  const oldestRef = useRef<Timestamp | null>(null);

  const attach = useCallback((q: Query<MessageDoc>, onFirst: (size: number, docs: Message[]) => void) => {
    let first = true;
    const unsub = onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
      setMap((prev) => {
        const next = new Map(prev);
        for (const change of snap.docChanges()) {
          if (change.type === "removed") continue; // slid out of the window; keep it
          next.set(change.doc.id, toMessage(change.doc));
        }
        return next;
      });
      if (first) {
        first = false;
        onFirst(snap.size, snap.docs.map(toMessage));
      }
    });
    pages.current.push(unsub);
  }, []);

  useEffect(() => {
    const current = pages.current;
    attach(latestQuery(), (size, docs) => {
      setInitialUnread(new Set(docs.filter((m) => m.senderId !== uid && !m.readAt).map((m) => m.id)));
      setReady(true);
      setHasMore(size >= PAGE_SIZE);
    });
    return () => {
      current.forEach((u) => u());
      current.length = 0;
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

  return { messages, initialUnread, ready, hasMore, loadingOlder, loadOlder };
}
