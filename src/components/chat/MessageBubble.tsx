"use client";

import { motion, type PanInfo } from "framer-motion";
import { formatInTimeZone } from "date-fns-tz";
import { Loader2, MoreHorizontal, Reply } from "lucide-react";
import Image from "next/image";
import { useRef } from "react";

import { VoicePlayer } from "@/components/chat/media/VoicePlayer";
import { Ticks } from "@/components/chat/Ticks";
import { STICKER_BY_ID } from "@/content/stickers";
import { cn } from "@/lib/cn";
import { thumbUrl } from "@/lib/cloudinary";
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
  onOpenImage: (message: Message) => void;
  /** Delete-for-everyone in flight (server call for media). */
  deleting?: boolean;
}

export function MessageBubble({
  message,
  mine,
  uid,
  tz,
  friendName,
  onOpenMenu,
  onReply,
  onReact,
  onOpenImage,
  deleting = false,
}: MessageBubbleProps) {
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
    if (info.offset.x > SWIPE_REPLY_PX && !message.deletedForEveryone)
      onReply(message);
  }

  const time = formatInTimeZone(new Date(message.createdAtMs), tz, "h:mm a");
  const deleted = message.deletedForEveryone;
  /** Stickers float without a bubble; photos and GIFs fill the bubble edge to edge. */
  const bare = message.type === "sticker" && !deleted;
  const visual =
    (message.type === "image" || message.type === "gif") && !deleted;

  const reactions = Object.entries(
    Object.entries(message.reactions).reduce<
      Record<string, { count: number; mine: boolean }>
    >((acc, [who, emoji]) => {
      acc[emoji] ??= { count: 0, mine: false };
      acc[emoji].count += 1;
      if (who === uid) acc[emoji].mine = true;
      return acc;
    }, {}),
  );

  return (
    <div
      className={cn(
        "group relative flex w-full items-end gap-1",
        mine ? "justify-end" : "justify-start",
      )}
    >
      {/* swipe hint */}
      <Reply
        size={16}
        aria-hidden
        className={cn(
          "absolute top-1/2 -translate-y-1/2 text-muted opacity-0 transition-opacity",
          mine ? "right-full mr-2" : "left-0",
        )}
      />

      <div
        className={cn(
          "flex max-w-[82%] flex-col gap-1",
          mine ? "items-end" : "items-start",
        )}
      >
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
            "relative max-w-full select-none",
            !bare && "rounded-[20px] shadow-sm",
            !bare &&
              (mine
                ? "rounded-br-md bg-accent-soft"
                : "rounded-bl-md bg-surface"),
            bare || visual ? "p-1" : "px-3.5 py-2",
            deleted && "opacity-80",
          )}
        >
          {message.replyTo && (
            <div
              className={cn(
                "mb-1.5 rounded-xl border-l-4 bg-bg/50 px-2.5 py-1.5 text-xs",
                (visual || bare) && "mx-1 mt-1",
                message.replyTo.senderId === uid
                  ? "border-[var(--accent)]"
                  : "border-muted",
              )}
            >
              <p className="font-bold">
                {message.replyTo.senderId === uid ? "You" : friendName}
              </p>
              <p className="line-clamp-2 text-muted">
                {message.replyTo.preview}
              </p>
            </div>
          )}

          {deleted ? (
            <p className="text-sm italic text-muted">
              This message was deleted
            </p>
          ) : (
            <MediaBody
              message={message}
              mine={mine}
              onOpenImage={onOpenImage}
            />
          )}

          <div
            className={cn(
              "mt-0.5 flex items-center justify-end gap-1 text-[10px] text-muted",
              (visual || bare) && "px-2 pb-0.5",
            )}
          >
            {message.editedAt && !deleted && <span>edited</span>}
            <span>{time}</span>
            {mine && (
              <Ticks status={message.status} pending={message.pending} />
            )}
          </div>

          {deleting && (
            <div
              className="absolute inset-0 grid place-items-center rounded-[20px] bg-bg/70 backdrop-blur-[1px]"
              role="status"
              aria-live="polite"
            >
              <span className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs font-bold shadow">
                <Loader2 size={14} className="animate-spin" aria-hidden />
                Deleting…
              </span>
            </div>
          )}
        </motion.div>

        {reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 px-1">
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
                  "flex h-7 items-center gap-1 rounded-full border px-2 text-sm shadow-sm",
                  isMine
                    ? "border-[var(--accent)] bg-surface-2"
                    : "border-border bg-surface",
                )}
              >
                <span>{emoji}</span>
                {count > 1 && <span className="font-bold">{count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

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

function MediaBody({
  message,
  mine,
  onOpenImage,
}: {
  message: Message;
  mine: boolean;
  onOpenImage: (m: Message) => void;
}) {
  const media = message.media ?? {};
  switch (message.type) {
    case "image": {
      const w = media.w ?? 4;
      const h = media.h ?? 3;
      return (
        <>
          {media.url && (
            <button
              type="button"
              onClick={() => onOpenImage(message)}
              aria-label="Open photo"
              className="block overflow-hidden rounded-[16px]"
            >
              <Image
                src={thumbUrl(media.url)}
                alt={message.text || "Photo"}
                width={w}
                height={h}
                unoptimized
                sizes="240px"
                loading="lazy"
                className="block max-h-80 w-60 max-w-full object-cover"
                style={{ aspectRatio: `${w} / ${h}` }}
              />
            </button>
          )}
          {message.text && (
            <p className="px-2.5 pt-1.5 pb-0.5 text-[15px] leading-snug whitespace-pre-wrap break-words">
              <Linkify text={message.text} />
            </p>
          )}
        </>
      );
    }
    case "gif": {
      const w = media.w ?? 200;
      const h = media.h ?? 200;
      return media.url ? (
        <Image
          src={media.url}
          alt="GIF"
          width={w}
          height={h}
          unoptimized sizes="240px" loading="lazy"
          className="block max-h-72 w-60 max-w-full rounded-[16px] object-cover"
          style={{ aspectRatio: `${w} / ${h}` }}
        />
      ) : null;
    }
    case "sticker": {
      const sticker = media.stickerId
        ? STICKER_BY_ID[media.stickerId]
        : undefined;
      return sticker ? (
        <sticker.Svg width={140} height={140} />
      ) : (
        <p className="text-sm text-muted">Sticker</p>
      );
    }
    case "voice":
      return media.url ? (
        <VoicePlayer
          url={media.url}
          durationMs={media.durationMs ?? 0}
          mine={mine}
        />
      ) : (
        <p className="text-sm text-muted">Voice note</p>
      );
    default:
      return (
        <p className="text-[15px] leading-snug whitespace-pre-wrap break-words">
          <Linkify text={message.text} />
        </p>
      );
  }
}
