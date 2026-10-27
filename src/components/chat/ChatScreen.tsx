"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ChatBackground } from "@/components/chat/ChatBackground";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { Composer } from "@/components/chat/Composer";
import { ImageViewer, ViewerButton } from "@/components/chat/media/ImageViewer";
import { MessageList } from "@/components/chat/MessageList";
import { MessageMenu } from "@/components/chat/MessageMenu";
import { ScheduleSheet } from "@/components/chat/ScheduleSheet";
import { WaitingCard } from "@/components/home/WaitingCard";
import { Splash } from "@/components/ui/Splash";
import { useMessages } from "@/hooks/useMessages";
import { usePair } from "@/hooks/usePair";
import { useUploads } from "@/hooks/useUploads";
import { useVisible } from "@/hooks/useVisible";
import { authedFetch } from "@/lib/api";
import { findMemoryByPublicId, saveMessageToMemories } from "@/lib/db/memories";
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
import { messagesCol } from "@/lib/db/messages";
import { getCountFromServer } from "@/lib/firebase/fs";
import { recordTogetherEvent } from "@/lib/garden";
import type { Gif } from "@/lib/giphy";
import type { Recording } from "@/lib/media/recorder";
import { notify } from "@/lib/notify";
import { playSound } from "@/lib/sounds";
import { swallow } from "@/lib/swallow";
import type { ChatBgPref, Message } from "@/lib/types";

export function ChatScreen() {
  const { uid, me, friend, friendUid, loading, pair } = usePair();

  if (!friendUid) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="px-1 text-3xl font-semibold">Chat</h1>
        <WaitingCard />
      </div>
    );
  }
  if (loading || !friend) return <Splash label="Finding your friend…" inline />;

  return <Thread uid={uid} tz={me.tz} chatBg={pair.chatBg ?? null} friendUid={friendUid} friendName={friend.nickname} friendDoc={friend} needsMessageSticker={!pair.garden?.stickers?.["messages-100"]} />;
}

interface ThreadProps {
  uid: string;
  tz: string;
  chatBg: ChatBgPref | null;
  friendUid: string;
  friendName: string;
  friendDoc: NonNullable<ReturnType<typeof usePair>["friend"]>;
  needsMessageSticker: boolean;
}

function Thread({ uid, tz, chatBg, friendUid, friendName, friendDoc, needsMessageSticker }: ThreadProps) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [layoutTick, setLayoutTick] = useState(0);

  // Android keyboards shrink the *visual* viewport without always resizing the
  // layout; size the thread to whatever is actually visible and keep the
  // composer at the visual bottom. The tab bar is honoured when it's on screen.
  useEffect(() => {
    const vv = window.visualViewport;
    const measure = () => {
      const el = root.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const mainBottom = el.closest("main")?.getBoundingClientRect().bottom ?? window.innerHeight;
      const vvBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
      setHeight(Math.max(240, Math.min(mainBottom, vvBottom) - top));
      setLayoutTick((t) => t + 1);
    };
    const raf = requestAnimationFrame(measure);
    vv?.addEventListener("resize", measure);
    vv?.addEventListener("scroll", measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      vv?.removeEventListener("resize", measure);
      vv?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, []);
  const { messages, initialUnread, ready, hasMore, loadingOlder, pageCount, loadOlder, prune } = useMessages(uid);
  const visible = useVisible();
  const [menuFor, setMenuFor] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [viewing, setViewing] = useState<Message | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set());
  const [schedule, setSchedule] = useState<{ open: boolean; draft: string }>({ open: false, draft: "" });
  const [savedToMemories, setSavedToMemories] = useState<string | null>(null);
  const [existingMemory, setExistingMemory] = useState<{ messageId: string; memoryId: string | null } | null>(null);
  const viewingPublicId = viewing?.media?.publicId ?? null;
  const viewingId = viewing?.id ?? null;
  useEffect(() => {
    if (!viewingId || !viewingPublicId) return;
    let cancelled = false;
    void findMemoryByPublicId(viewingPublicId)
      .then((memoryId) => !cancelled && setExistingMemory({ messageId: viewingId, memoryId }))
      .catch(swallow);
    return () => {
      cancelled = true;
    };
  }, [viewingId, viewingPublicId]);
  const uploads = useUploads(uid, friendUid);

  // Read receipts: only while this screen is mounted and the tab is visible.
  const reading = useRef(new Set<string>());
  useEffect(() => {
    if (!visible || !ready) return;
    const toRead = messages.filter(
      (m) => m.senderId === friendUid && m.type !== "system" && !m.readAt && !m.pending && !reading.current.has(m.id),
    );
    if (toRead.length === 0) return;
    toRead.forEach((m) => reading.current.add(m.id));
    markRead(toRead)
      .catch(swallow)
      .finally(() => toRead.forEach((m) => reading.current.delete(m.id)));
  }, [messages, visible, ready, friendUid]);

  const send = useCallback(
    async (text: string) => {
      const reply = replyTo ? replyPreview(replyTo) : null;
      setReplyTo(null);
      const id = await sendText(uid, text, reply);
      playSound("send");
      setLayoutTick((t) => t + 1);
      await notify("message", { toUid: friendUid, body: text.slice(0, 120), data: { messageId: id } });
      if (needsMessageSticker) void getCountFromServer(messagesCol()).then((c) => c.data().count >= 100 && recordTogetherEvent("messages-100", uid)).catch(swallow);
    },
    [uid, friendUid, replyTo, needsMessageSticker],
  );

  const saveEdit = useCallback(async (m: Message, text: string) => {
    setEditing(null);
    await editText(m.id, text);
  }, []);

  const react = useCallback((m: Message, emoji: string) => void toggleReaction(m, uid, emoji).catch(swallow), [uid]);
  const startReply = useCallback((m: Message) => {
    setEditing(null);
    setReplyTo(m);
  }, []);

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
    setDeletingIds((ids) => new Set(ids).add(m.id));
    try {
      if (hasCloudinaryAsset(m)) {
        try {
          const res = await authedFetch("/api/media", { method: "DELETE", body: JSON.stringify({ messageId: m.id }) });
          if (res.ok) return;
        } catch {
          // Fall through to the client-side soft delete; the asset stays until retried.
        }
      }
      await deleteForEveryone(m.id).catch(swallow);
    } finally {
      setDeletingIds((ids) => {
        const next = new Set(ids);
        next.delete(m.id);
        return next;
      });
    }
  }, []);

  return (
    <div ref={root} className="-mx-4 -mt-4 -mb-6 flex min-h-0 flex-1 flex-col" style={height ? { height, flex: "none" } : undefined}>
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
        onReply={startReply}
        onReact={react}
        onOpenImage={setViewing}
        deletingIds={deletingIds}
        backdrop={<ChatBackground pref={chatBg} />}
        uploads={uploads.uploads}
        onRetryUpload={uploads.retry}
        onDismissUpload={uploads.dismiss}
        layoutTick={layoutTick}
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
        onSendSticker={(id) => void sendSticker(id).catch(swallow)}
        onSendGif={(gif) => void sendGif(gif).catch(swallow)}
        onSchedule={(draft) => setSchedule({ open: true, draft })}
        onFocusInput={() => setLayoutTick((t) => t + 1)}
      />
      <ScheduleSheet
        open={schedule.open}
        uid={uid}
        draft={schedule.draft}
        onClose={() => setSchedule({ open: false, draft: "" })}
        onScheduled={() => setSchedule({ open: false, draft: "" })}
      />
      <ImageViewer
        media={viewing?.media ?? null}
        caption={viewing?.text}
        actions={
          viewing ? (
            existingMemory?.messageId === viewing.id && existingMemory.memoryId ? (
              <ViewerButton
                onClick={() => {
                  setViewing(null);
                  router.push("/memories/photos");
                }}
              >
                Already in memories · open
              </ViewerButton>
            ) : (
              <ViewerButton
                onClick={() => {
                  const target = viewing;
                  void saveMessageToMemories(uid, target)
                    .then((id) => {
                      setSavedToMemories(target.id);
                      setExistingMemory({ messageId: target.id, memoryId: id });
                    })
                    .catch(swallow);
                }}
              >
                {savedToMemories === viewing.id ? "Saved ✓" : "Save to memories"}
              </ViewerButton>
            )
          ) : undefined
        }
        onClose={() => setViewing(null)}
      />
      <MessageMenu
        message={menuFor}
        uid={uid}
        onClose={() => setMenuFor(null)}
        onReact={react}
        onReply={startReply}
        onEdit={(m) => {
          setReplyTo(null);
          setEditing(m);
        }}
        onDeleteForMe={(m) => void deleteForMe(m.id, uid).catch(swallow)}
        onDeleteForEveryone={(m) => void removeForEveryone(m)}
      />
    </div>
  );
}
