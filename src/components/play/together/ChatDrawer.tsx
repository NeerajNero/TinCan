"use client";

import { MessageCircle, X } from "lucide-react";
import { useState } from "react";

import { Composer } from "@/components/chat/Composer";
import { Portal } from "@/components/ui/Portal";
import { Sheet } from "@/components/ui/Sheet";
import { useMessages } from "@/hooks/useMessages";
import { usePair } from "@/hooks/usePair";
import { useUploads } from "@/hooks/useUploads";
import { cn } from "@/lib/cn";
import { mediaLabel, sendMedia, sendText } from "@/lib/db/messages";
import { notify } from "@/lib/notify";

/** A small chat drawer for watch/listen: last 20 messages + the real composer. */
export function ChatDrawer() {
  const { uid, friend, friendUid } = usePair();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Portal>
        <button type="button" onClick={() => setOpen(true)} aria-label="Open chat" className="tap fixed right-4 bottom-[calc(var(--tabbar-h)+24px)] z-30 grid size-12 place-items-center rounded-full bg-[var(--accent)] text-white shadow-lg">
          <MessageCircle size={22} />
        </button>
      </Portal>
      <Sheet open={open && Boolean(friendUid)} onClose={() => setOpen(false)} label="Chat" tone="bg" height="70dvh" scroll={false} className="px-0">
        <div className="flex items-center justify-between px-4">
          <p className="font-heading font-semibold">Chat with {friend?.nickname}</p>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="tap grid size-10 place-items-center rounded-full text-muted">
            <X size={18} />
          </button>
        </div>
        {friendUid && <DrawerBody uid={uid} friendUid={friendUid} friendName={friend?.nickname ?? "Friend"} />}
      </Sheet>
    </>
  );
}

function DrawerBody({ uid, friendUid, friendName }: { uid: string; friendUid: string; friendName: string }) {
  const { messages } = useMessages(uid);
  const uploads = useUploads(uid, friendUid);
  const last = messages.filter((m) => !m.deletedFor.includes(uid)).slice(-20);
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col-reverse gap-1.5 overflow-y-auto px-4 py-2">
        {[...last].reverse().map((m) => (
          <p key={m.id} className={cn("max-w-[85%] rounded-2xl px-3 py-1.5 text-sm", m.type === "system" ? "self-center bg-surface-2 text-xs text-muted" : m.senderId === uid ? "self-end bg-accent-soft" : "self-start bg-surface")}>
            {mediaLabel(m)}
          </p>
        ))}
        {last.length === 0 && <p className="self-center text-xs text-muted">Say something about what you&apos;re watching.</p>}
      </div>
      <Composer
        uid={uid}
        friendName={friendName}
        replyTo={null}
        editing={null}
        onCancelReply={() => undefined}
        onCancelEdit={() => undefined}
        onSend={async (text) => {
          const id = await sendText(uid, text, null);
          void notify("message", { toUid: friendUid, body: text.slice(0, 120), data: { messageId: id } });
        }}
        onSaveEdit={async () => undefined}
        onSendImages={(files, caption) => uploads.sendImages(files, caption, null)}
        onSendVoice={(rec) => uploads.sendVoice(rec, null)}
        onSendSticker={(stickerId) => void sendMedia(uid, "sticker", { stickerId })}
        onSendGif={(gif) => void sendMedia(uid, "gif", { url: gif.url, w: gif.w, h: gif.h })}
        onSchedule={() => undefined}
      />
    </>
  );
}
