"use client";

import { format } from "date-fns";
import { m } from "framer-motion";
import { Copy, MessageCircle, MoreVertical, Send, Share2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useToast } from "@/components/toast/ToastProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Portal } from "@/components/ui/Portal";
import { Sheet } from "@/components/ui/Sheet";
import { usePair } from "@/hooks/usePair";
import { useRoomChat } from "@/hooks/useRoomChat";
import { cn } from "@/lib/cn";
import { autoGrow, enterSends } from "@/lib/composerKeys";
import { sendText } from "@/lib/db/messages";
import { focusNoScroll } from "@/lib/focus";
import { Linkify } from "@/lib/linkify";
import { readPref, writePref } from "@/lib/localPref";
import { notify } from "@/lib/notify";
import { latestAt, ROOM_TEXT_MAX, type ChatRoom, type RoomMessage } from "@/lib/roomChat";
import { errorMessage, swallow } from "@/lib/swallow";

const LONG_PRESS_MS = 420;
const ROOM = {
  watch: { title: "Watch chat", emoji: "📺", empty: "Say something about what you're watching." },
  listen: { title: "Listen chat", emoji: "🎧", empty: "Say something about what you're listening to." },
} as const;

/**
 * The Watch / Listen side chat: its own short thread at roomchat/{room}, kept
 * apart from the main chat (no push, no badge). The listener lives here, not in
 * the sheet, so the unread dot works while the drawer is closed.
 */
export function ChatDrawer({ room }: { room: ChatRoom }) {
  const { uid, friendUid } = usePair();
  const { messages, send, clear } = useRoomChat(room, uid);
  const [open, setOpen] = useState(false);
  const seenKey = `tincan.roomchat.seen.${room}`;
  const [seenAt, setSeenAt] = useState(() => Number(readPref(seenKey)) || 0);
  const list = messages ?? [];
  const newest = latestAt(list);
  const unread = !open && latestAt(list, uid) > seenAt;

  // While open, everything shown counts as seen (kept on this device only).
  useEffect(() => {
    if (open && newest) writePref(seenKey, String(newest));
  }, [open, newest, seenKey]);

  const toggle = (next: boolean) => {
    setOpen(next);
    setSeenAt((s) => Math.max(s, newest));
  };

  return (
    <>
      <Portal>
        <button type="button" onClick={() => toggle(true)} aria-label={unread ? `Open ${ROOM[room].title} (new messages)` : `Open ${ROOM[room].title}`} className="tap fixed right-4 bottom-[calc(var(--tabbar-h)+24px)] z-30 grid size-12 place-items-center rounded-full bg-[var(--accent)] text-white shadow-lg">
          <MessageCircle size={22} />
          {unread && <span className="absolute top-0.5 right-0.5 size-3.5 rounded-full bg-red-500 ring-2 ring-bg" aria-hidden />}
        </button>
      </Portal>
      <Sheet open={open && Boolean(friendUid)} onClose={() => toggle(false)} label={ROOM[room].title} tone="bg" height="55dvh" expandedHeight="92dvh" scroll={false} className="px-0">
        {friendUid && <DrawerBody room={room} uid={uid} friendUid={friendUid} messages={messages} send={send} clear={clear} onClose={() => toggle(false)} />}
      </Sheet>
    </>
  );
}

interface BodyProps {
  room: ChatRoom;
  uid: string;
  friendUid: string;
  messages: RoomMessage[] | null;
  send: (text: string) => Promise<void>;
  clear: () => Promise<void>;
  onClose: () => void;
}

function DrawerBody({ room, uid, friendUid, messages, send, clear, onClose }: BodyProps) {
  const { me, friend } = usePair();
  const { toast } = useToast();
  const [menu, setMenu] = useState<"closed" | "open" | "confirm">("closed");
  const [selected, setSelected] = useState<string | null>(null);
  const meta = ROOM[room];

  async function copy(text: string) {
    setSelected(null);
    try {
      await navigator.clipboard.writeText(text);
      toast({ emoji: "📋", title: "Copied", vibrate: false, durationMs: 1800 });
    } catch {
      toast({ emoji: "📋", title: "Couldn't copy that", vibrate: false });
    }
  }

  async function share(text: string) {
    setSelected(null);
    const body = `${meta.emoji} ${text}`;
    try {
      const id = await sendText(uid, body, null);
      void notify("message", { toUid: friendUid, body: body.slice(0, 120), data: { messageId: id } });
      toast({ emoji: "💬", title: "Shared to main chat", vibrate: false, durationMs: 1800 });
    } catch (err) {
      toast({ emoji: "💬", title: errorMessage(err, "Couldn't share that"), vibrate: false });
    }
  }

  return (
    <>
      <div className="flex items-center gap-1 px-4">
        <div className="min-w-0 flex-1">
          <p className="font-heading font-semibold">{meta.title}</p>
          <p className="text-[11px] text-muted">
            Just for this room · last 50 messages ·{" "}
            <Link href="/chat" className="font-bold text-[var(--accent)] underline-offset-2 hover:underline">
              Open main chat
            </Link>
          </p>
        </div>
        <button type="button" onClick={() => setMenu((v) => (v === "closed" ? "open" : "closed"))} aria-label="Chat options" aria-expanded={menu !== "closed"} className="tap grid size-10 place-items-center rounded-full text-muted">
          <MoreVertical size={18} />
        </button>
        <button type="button" onClick={onClose} aria-label="Close" className="tap grid size-10 place-items-center rounded-full text-muted">
          <X size={18} />
        </button>
      </div>
      {menu !== "closed" && (
        <div className="mx-4 mt-1 flex items-center gap-2 rounded-2xl bg-surface px-3 py-1.5 text-sm">
          {menu === "open" ? (
            <button type="button" onClick={() => setMenu("confirm")} disabled={!messages?.length} className="tap font-bold text-red-500 disabled:opacity-50">
              Clear chat
            </button>
          ) : (
            <>
              <span className="flex-1">Clear the whole {meta.title.toLowerCase()} for both of you?</span>
              <button type="button" onClick={() => setMenu("closed")} className="tap px-2 font-bold text-muted">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenu("closed");
                  void clear();
                }}
                className="tap px-2 font-bold text-red-500"
              >
                Clear
              </button>
            </>
          )}
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col-reverse gap-1.5 overflow-y-auto overscroll-contain px-3 py-2">
        {[...(messages ?? [])].reverse().map((msg) => {
          const mine = msg.uid === uid;
          return (
            <div key={msg.id} className="flex flex-col gap-1">
              <RoomBubble message={msg} mine={mine} sender={mine ? me : friend} onSelect={() => setSelected((s) => (s === msg.id ? null : msg.id))} />
              {selected === msg.id && (
                <div className={cn("flex gap-1.5 px-8", mine ? "justify-end" : "justify-start")}>
                  <ActionChip icon={<Copy size={14} />} label="Copy" onClick={() => void copy(msg.text)} />
                  <ActionChip icon={<Share2 size={14} />} label="Share to main chat" onClick={() => void share(msg.text)} />
                </div>
              )}
            </div>
          );
        })}
        {messages !== null && messages.length === 0 && <p className="self-center py-6 text-xs text-muted">{meta.empty}</p>}
      </div>
      <RoomComposer room={room} onSend={send} />
    </>
  );
}

function ActionChip({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="tap flex items-center gap-1.5 rounded-full bg-surface px-3 text-xs font-bold shadow-sm">
      {icon}
      {label}
    </button>
  );
}

/** Main-chat bubble styling, minus ticks, reactions, replies, edits and media. */
function RoomBubble({ message, mine, sender, onSelect }: { message: RoomMessage; mine: boolean; sender: Parameters<typeof Avatar>[0]["user"] | null; onSelect: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return (
    <div className={cn("flex items-end gap-1.5", mine && "flex-row-reverse")}>
      {sender ? <Avatar user={sender} size={24} /> : <span className="size-6 shrink-0" />}
      <div
        onPointerDown={(e) => {
          if (e.pointerType === "mouse") return;
          cancel();
          timer.current = setTimeout(() => {
            timer.current = null;
            try {
              navigator.vibrate?.(15);
            } catch {
              // no haptics
            }
            onSelect();
          }, LONG_PRESS_MS);
        }}
        onPointerUp={cancel}
        onPointerCancel={cancel}
        onPointerLeave={cancel}
        onContextMenu={(e) => {
          e.preventDefault();
          onSelect();
        }}
        className={cn(
          "relative max-w-[78%] rounded-[20px] px-3.5 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.12)] select-none",
          mine ? "rounded-br-md bg-[var(--bubble-mine)]" : "rounded-bl-md bg-[var(--bubble-theirs)]",
        )}
      >
        <p className="text-[15px] leading-snug whitespace-pre-wrap break-words">
          <Linkify text={message.text} />
        </p>
        <p className="mt-0.5 text-right text-[10px] text-muted">{format(message.at, "h:mm a")}</p>
      </div>
    </div>
  );
}

/** Text and emoji only; the same Enter behaviour as the main composer. */
function RoomComposer({ room, onSend }: { room: ChatRoom; onSend: (text: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const value = text.trim();
  const canSend = !busy && value.length > 0 && value.length <= ROOM_TEXT_MAX;

  useEffect(() => {
    autoGrow(textarea.current, 4);
  }, [text]);

  async function submit() {
    if (!canSend) return;
    setBusy(true);
    setText("");
    try {
      await onSend(value);
    } catch (err) {
      setText(value);
      toast({ emoji: "💬", title: errorMessage(err, "Couldn't send"), vibrate: false });
    } finally {
      setBusy(false);
      focusNoScroll(textarea.current);
    }
  }

  return (
    <div className="flex items-end gap-1.5 border-t border-border px-3 pt-2">
      <textarea
        ref={textarea}
        value={text}
        rows={1}
        maxLength={ROOM_TEXT_MAX}
        placeholder={room === "watch" ? "Talk about the video…" : "Talk about the music…"}
        aria-label="Message"
        enterKeyHint="enter"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (!enterSends(e)) return;
          e.preventDefault();
          void submit().catch(swallow);
        }}
        className="max-h-[110px] min-h-11 flex-1 resize-none rounded-[22px] border border-border bg-surface px-4 py-2.5 text-[15px] leading-[22px] placeholder:text-muted/70 focus:border-[var(--accent)] focus:outline-none"
      />
      <m.button type="button" onClick={() => void submit()} disabled={!canSend} aria-label="Send" whileTap={{ scale: 0.9 }} className="tap grid size-11 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-white shadow-md disabled:opacity-40">
        <Send size={18} className="-ml-0.5" />
      </m.button>
    </div>
  );
}
