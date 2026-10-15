"use client";

import { motion, type PanInfo } from "framer-motion";
import { formatInTimeZone } from "date-fns-tz";
import { MoreHorizontal, Reply } from "lucide-react";
import { useRef } from "react";

import { Ticks } from "@/components/chat/Ticks";
import { cn } from "@/lib/cn";
import { Linkify } from "@/lib/linkify";
import type { Message } from "@/lib/types";

const LONG_PRESS_MS = 420;
const SWIPE_REPLY_PX = 56;

interface MessageBubbleProps {
  message: Message;
  mine: boolean;
  uid: string;
  tz: string;
  friendName: string;
  onOpenMenu: (message: Message) => void;
  onReply: (message: Message) => void;
  onReact: (message: Message, emoji: string) => void;
}

export function MessageBubble({ message, mine, uid, tz, friendName, onOpenMenu, onReply, onReact }: MessageBubbleProps) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);

  function startPress(e: React.PointerEvent) {
    if (e.pointerType === "mouse") return;
    cancelPress();
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null;
      suppressClick.current = true;
      try {
        navigator.vibrate?.(15);
      } catch {
        // no haptics
      }
      onOpenMenu(message);
    }, LONG_PRESS_MS);
  }
  function cancelPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  }
  function onDragEnd(_: unknown, info: PanInfo) {
    cancelPress();
    if (info.offset.x > SWIPE_REPLY_PX && !message.deletedForEveryone) onReply(message);
  }

  const time = formatInTimeZone(new Date(message.createdAtMs), tz, "h:mm a");
  const reactions = Object.entries(
    Object.entries(message.reactions).reduce<Record<string, { count: number; mine: boolean }>>((acc, [who, emoji]) => {
      acc[emoji] ??= { count: 0, mine: false };
      acc[emoji].count += 1;
      if (who === uid) acc[emoji].mine = true;
      return acc;
    }, {}),
  );

  return (
    <div className={cn("group relative flex w-full items-end gap-1", mine ? "justify-end" : "justify-start")}>
      {/* swipe hint */}
      <Reply
        size={16}
        aria-hidden
        className={cn("absolute top-1/2 -translate-y-1/2 text-muted opacity-0 transition-opacity", mine ? "right-full mr-2" : "left-0")}
      />

      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.35 }}
        dragSnapToOrigin
        onDragStart={cancelPress}
        onDragEnd={onDragEnd}
        onPointerDown={startPress}
        onPointerUp={cancelPress}
        onPointerCancel={cancelPress}
        onPointerLeave={cancelPress}
        onContextMenu={(e) => {
          e.preventDefault();
          onOpenMenu(message);
        }}
        onClick={() => {
          if (suppressClick.current) suppressClick.current = false;
        }}
        className={cn(
          "relative max-w-[82%] rounded-[20px] px-3.5 py-2 shadow-sm select-none",
          mine ? "rounded-br-md bg-accent-soft" : "rounded-bl-md bg-surface",
          message.deletedForEveryone && "opacity-80",
        )}
      >
        {message.replyTo && (
          <div
            className={cn(
              "mb-1.5 rounded-xl border-l-4 bg-bg/50 px-2.5 py-1.5 text-xs",
              message.replyTo.senderId === uid ? "border-[var(--accent)]" : "border-muted",
            )}
          >
            <p className="font-bold">{message.replyTo.senderId === uid ? "You" : friendName}</p>
            <p className="line-clamp-2 text-muted">{message.replyTo.preview}</p>
          </div>
        )}

        {message.deletedForEveryone ? (
          <p className="text-sm italic text-muted">This message was deleted</p>
        ) : (
          <p className="text-[15px] leading-snug whitespace-pre-wrap break-words">
            <Linkify text={message.text} />
          </p>
        )}

        <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-muted">
          {message.editedAt && !message.deletedForEveryone && <span>edited</span>}
          <span>{time}</span>
          {mine && <Ticks status={message.status} pending={message.pending} />}
        </div>

        {reactions.length > 0 && (
          <div className={cn("absolute -bottom-3 flex gap-1", mine ? "right-2" : "left-2")}>
            {reactions.map(([emoji, { count, mine: isMine }]) => (
              <button
                key={emoji}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onReact(message, emoji);
                }}
                aria-label={`${emoji} ${count}${isMine ? ", yours" : ""}`}
                aria-pressed={isMine}
                className={cn(
                  "flex h-6 items-center gap-0.5 rounded-full border px-1.5 text-xs shadow-sm",
                  isMine ? "border-[var(--accent)] bg-accent-soft" : "border-border bg-surface",
                )}
              >
                <span>{emoji}</span>
                {count > 1 && <span className="font-bold">{count}</span>}
              </button>
            ))}
          </div>
        )}
      </motion.div>

      {/* desktop hover affordance */}
      <button
        type="button"
        aria-label="Message options"
        onClick={() => onOpenMenu(message)}
        className={cn(
          "mb-1 hidden size-8 shrink-0 place-items-center rounded-full text-muted opacity-0 transition-opacity hover:bg-surface-2 group-hover:opacity-100 [@media(hover:hover)]:grid",
          mine && "order-first",
        )}
      >
        <MoreHorizontal size={16} />
      </button>
    </div>
  );
}
