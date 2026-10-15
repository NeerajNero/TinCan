"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ChatHeader } from "@/components/chat/ChatHeader";
import { Composer } from "@/components/chat/Composer";
import { MessageList } from "@/components/chat/MessageList";
import { MessageMenu } from "@/components/chat/MessageMenu";
import { WaitingCard } from "@/components/home/WaitingCard";
import { Splash } from "@/components/ui/Splash";
import { useMessages } from "@/hooks/useMessages";
import { usePair } from "@/hooks/usePair";
import { useVisible } from "@/hooks/useVisible";
import {
  deleteForEveryone,
  deleteForMe,
  editText,
  markRead,
  replyPreview,
  sendText,
  toggleReaction,
} from "@/lib/db/messages";
import { notify } from "@/lib/notify";
import type { Message } from "@/lib/types";

export function ChatScreen() {
  const { uid, me, friend, friendUid, loading } = usePair();

  if (!friendUid) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="px-1 text-3xl font-semibold">Chat</h1>
        <WaitingCard />
      </div>
    );
  }
  if (loading || !friend) return <Splash label="Finding your friend…" />;

  return <Thread uid={uid} tz={me.tz} friendUid={friendUid} friendName={friend.nickname} friendDoc={friend} />;
}

interface ThreadProps {
  uid: string;
  tz: string;
  friendUid: string;
  friendName: string;
  friendDoc: NonNullable<ReturnType<typeof usePair>["friend"]>;
}

function Thread({ uid, tz, friendUid, friendName, friendDoc }: ThreadProps) {
  const { messages, initialUnread, ready, hasMore, loadingOlder, loadOlder } = useMessages(uid);
  const visible = useVisible();
  const [menuFor, setMenuFor] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);

  // Read receipts: only while this screen is mounted and the tab is visible.
  const reading = useRef(new Set<string>());
  useEffect(() => {
    if (!visible || !ready) return;
    const toRead = messages.filter(
      (m) => m.senderId === friendUid && !m.readAt && !m.pending && !reading.current.has(m.id),
    );
    if (toRead.length === 0) return;
    toRead.forEach((m) => reading.current.add(m.id));
    markRead(toRead)
      .catch(() => undefined)
      .finally(() => toRead.forEach((m) => reading.current.delete(m.id)));
  }, [messages, visible, ready, friendUid]);

  const send = useCallback(
    async (text: string) => {
      const reply = replyTo ? replyPreview(replyTo) : null;
      setReplyTo(null);
      const id = await sendText(uid, text, reply);
      await notify("message", { toUid: friendUid, body: text.slice(0, 120), data: { messageId: id } });
    },
    [uid, friendUid, replyTo],
  );

  const saveEdit = useCallback(async (m: Message, text: string) => {
    setEditing(null);
    await editText(m.id, text);
  }, []);

  const react = useCallback((m: Message, emoji: string) => void toggleReaction(m, uid, emoji).catch(() => undefined), [uid]);

  return (
    <div className="-mx-4 -mt-4 -mb-6 flex min-h-0 flex-1 flex-col">
      <ChatHeader friend={friendDoc} friendUid={friendUid} />
      <MessageList
        messages={messages}
        ready={ready}
        hasMore={hasMore}
        loadingOlder={loadingOlder}
        loadOlder={loadOlder}
        uid={uid}
        tz={tz}
        friendName={friendName}
        initialUnread={initialUnread}
        onOpenMenu={setMenuFor}
        onReply={(m) => {
          setEditing(null);
          setReplyTo(m);
        }}
        onReact={react}
      />
      <Composer
        key={editing ? `edit:${editing.id}` : "compose"}
        uid={uid}
        friendName={friendName}
        replyTo={replyTo}
        editing={editing}
        onCancelReply={() => setReplyTo(null)}
        onCancelEdit={() => setEditing(null)}
        onSend={send}
        onSaveEdit={saveEdit}
      />
      <MessageMenu
        message={menuFor}
        uid={uid}
        onClose={() => setMenuFor(null)}
        onReact={react}
        onReply={(m) => {
          setEditing(null);
          setReplyTo(m);
        }}
        onEdit={(m) => {
          setReplyTo(null);
          setEditing(m);
        }}
        onDeleteForMe={(m) => void deleteForMe(m.id, uid).catch(() => undefined)}
        onDeleteForEveryone={(m) => void deleteForEveryone(m.id).catch(() => undefined)}
      />
    </div>
  );
}
