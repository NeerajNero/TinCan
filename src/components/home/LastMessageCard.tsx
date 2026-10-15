"use client";

import { formatDistanceToNowStrict } from "date-fns";
import Link from "next/link";

import { useChatMeta } from "@/hooks/useChatMeta";
import { usePair } from "@/hooks/usePair";
import { mediaLabel } from "@/lib/db/messages";

/** One-line peek at the latest message; taps through to the chat. */
export function LastMessageCard({ friendName }: { friendName: string }) {
  const { uid } = usePair();
  const { lastMessage: m, unreadCount } = useChatMeta();

  const body = !m ? `No messages yet — say hi to ${friendName}?` : mediaLabel(m);
  const who = !m || m.type === "system" ? "" : m.senderId === uid ? "You: " : `${friendName}: `;

  return (
    <Link href="/chat" className="card tap flex items-center gap-3 rounded-[24px] px-4 py-3" style={{ "--accent": "var(--accent-chat)" } as React.CSSProperties}>
      <span className="text-3xl" aria-hidden>
        💬
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-muted">Chat</span>
          {m && <span className="text-[11px] text-muted">{formatDistanceToNowStrict(new Date(m.createdAtMs), { addSuffix: true })}</span>}
        </span>
        <span className="block truncate text-sm">
          <span className="font-bold">{who}</span>
          {body}
        </span>
      </span>
      {unreadCount > 0 && (
        <span className="min-w-6 rounded-full bg-[var(--accent)] px-2 text-center text-xs font-bold leading-6 text-white" aria-label={`${unreadCount} unread`}>
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
