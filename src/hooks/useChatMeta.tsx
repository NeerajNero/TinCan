"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import { usePair } from "@/hooks/usePair";
import { lastMessageQuery, markDelivered, toMessage, unreadQuery } from "@/lib/db/messages";
import { onSnapshot } from "@/lib/firebase/fs";
import { swallow } from "@/lib/swallow";
import type { Message } from "@/lib/types";
interface ChatMeta {
  /** Incoming messages not yet read (≤ 99). */
  unreadCount: number;
  lastMessage: Message | null;
}

const ChatMetaContext = createContext<ChatMeta>({ unreadCount: 0, lastMessage: null });

/**
 * App-wide chat listeners, exactly two: the unread badge query and the latest
 * message. The unread listener also acknowledges delivery for anything still
 * marked "sent", so double ticks appear even when the chat isn't open.
 */
export function ChatMetaProvider({ children }: { children: React.ReactNode }) {
  const { friendUid } = usePair();
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastMessage, setLastMessage] = useState<Message | null>(null);
  const delivering = useRef(new Set<string>());

  useEffect(() => {
    if (!friendUid) return;
    const unsub = onSnapshot(unreadQuery(friendUid), (snap) => {
      // Server-written system lines from before phase 18 carry readAt: null; they never count or get ticks.
      const incoming = snap.docs.filter((d) => d.data().type !== "system");
      setUnreadCount(incoming.length);
      const toDeliver = incoming
        .filter((d) => !d.metadata.hasPendingWrites && d.data().status === "sent" && !delivering.current.has(d.id))
        .map((d) => d.id);
      if (toDeliver.length) {
        toDeliver.forEach((id) => delivering.current.add(id));
        markDelivered(toDeliver)
          .catch(swallow)
          .finally(() => toDeliver.forEach((id) => delivering.current.delete(id)));
      }
    });
    return () => {
      unsub();
      setUnreadCount(0);
    };
  }, [friendUid]);

  useEffect(() => {
    if (!friendUid) return;
    const unsub = onSnapshot(lastMessageQuery(), { includeMetadataChanges: true }, (snap) => {
      const first = snap.docs[0];
      setLastMessage(first ? toMessage(first) : null);
    });
    return () => {
      unsub();
      setLastMessage(null);
    };
  }, [friendUid]);

  const value = useMemo(() => ({ unreadCount, lastMessage }), [unreadCount, lastMessage]);
  return <ChatMetaContext.Provider value={value}>{children}</ChatMetaContext.Provider>;
}

export function useChatMeta(): ChatMeta {
  return useContext(ChatMetaContext);
}
