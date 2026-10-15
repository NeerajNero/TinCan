"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ChatHeader } from "@/components/chat/ChatHeader";
import { Composer } from "@/components/chat/Composer";
import { ImageViewer } from "@/components/chat/media/ImageViewer";
import { MessageList } from "@/components/chat/MessageList";
import { MessageMenu } from "@/components/chat/MessageMenu";
import { WaitingCard } from "@/components/home/WaitingCard";
import { Splash } from "@/components/ui/Splash";
import { useMessages } from "@/hooks/useMessages";
import { usePair } from "@/hooks/usePair";
import { useUploads } from "@/hooks/useUploads";
import { useVisible } from "@/hooks/useVisible";
import { authedFetch } from "@/lib/api";
import {
  deleteForEveryone,
  deleteForMe,
  editText,
  hasCloudinaryAsset,
  markRead,
  replyPreview,
  sendMedia,
  sendText,
  toggleReaction,
} from "@/lib/db/messages";
import type { Gif } from "@/lib/giphy";
import type { Recording } from "@/lib/media/recorder";
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
  const { messages, initialUnread, ready, hasMore, loadingOlder, pageCount, loadOlder, prune } = useMessages(uid);
  const visible = useVisible();
  const [menuFor, setMenuFor] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [viewing, setViewing] = useState<Message | null>(null);
  const uploads = useUploads(uid, friendUid);

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

  const takeReply = useCallback(() => {
    const reply = replyTo ? replyPreview(replyTo) : null;
    setReplyTo(null);
    return reply;
  }, [replyTo]);

  const sendImages = useCallback((files: File[], caption: string) => uploads.sendImages(files, caption, takeReply()), [uploads, takeReply]);
  const sendVoice = useCallback((rec: Recording) => uploads.sendVoice(rec, takeReply()), [uploads, takeReply]);
  const sendSticker = useCallback(
    async (stickerId: string) => {
      const id = await sendMedia(uid, "sticker", { stickerId }, "", takeReply());
      await notify("message", { toUid: friendUid, body: "Sticker", data: { messageId: id } });
    },
    [uid, friendUid, takeReply],
  );
  const sendGif = useCallback(
    async (gif: Gif) => {
      const id = await sendMedia(uid, "gif", { url: gif.url, w: gif.w, h: gif.h }, "", takeReply());
      await notify("message", { toUid: friendUid, body: "GIF", data: { messageId: id } });
    },
    [uid, friendUid, takeReply],
  );

  /** Photos and voice notes go through the server so the Cloudinary asset is destroyed too. */
  const removeForEveryone = useCallback(async (m: Message) => {
    if (hasCloudinaryAsset(m)) {
      try {
        const res = await authedFetch("/api/media", { method: "DELETE", body: JSON.stringify({ messageId: m.id }) });
        if (res.ok) return;
      } catch {
        // Fall through to the client-side soft delete; the asset stays until retried.
      }
    }
    await deleteForEveryone(m.id).catch(() => undefined);
  }, []);

  return (
    <div className="-mx-4 -mt-4 -mb-6 flex min-h-0 flex-1 flex-col">
      <ChatHeader friend={friendDoc} friendUid={friendUid} />
      <MessageList
        messages={messages}
        ready={ready}
        hasMore={hasMore}
        loadingOlder={loadingOlder}
        pageCount={pageCount}
        loadOlder={loadOlder}
        prune={prune}
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
        onOpenImage={setViewing}
        uploads={uploads.uploads}
        onRetryUpload={uploads.retry}
        onDismissUpload={uploads.dismiss}
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
        onSendImages={sendImages}
        onSendVoice={sendVoice}
        onSendSticker={(id) => void sendSticker(id).catch(() => undefined)}
        onSendGif={(gif) => void sendGif(gif).catch(() => undefined)}
      />
      <ImageViewer src={viewing?.media?.url ?? null} caption={viewing?.text} onClose={() => setViewing(null)} />
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
        onDeleteForEveryone={(m) => void removeForEveryone(m)}
      />
    </div>
  );
}
