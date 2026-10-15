"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { Avatar } from "@/components/ui/Avatar";
import { useFriendTyping } from "@/hooks/useTyping";
import { useRtdbValue } from "@/hooks/useRtdbValue";
import { cn } from "@/lib/cn";
import { presencePath } from "@/lib/rtdb";
import type { PresenceNode, UserDoc } from "@/lib/types";

export function ChatHeader({ friend, friendUid }: { friend: UserDoc; friendUid: string }) {
  const { value: presence } = useRtdbValue<PresenceNode>(presencePath(friendUid));
  const typing = useFriendTyping(friendUid);
  const online = presence?.online === true;

  const sub = typing
    ? "typing…"
    : online
      ? "online"
      : presence?.lastSeen
        ? `last seen ${formatDistanceToNowStrict(new Date(presence.lastSeen), { addSuffix: true })}`
        : "";

  return (
    <header className="flex items-center gap-3 border-b border-border bg-bg/90 px-4 py-2.5 backdrop-blur-md">
      <div className="relative shrink-0">
        <Avatar user={friend} size={40} />
        <span
          aria-hidden
          className={cn("absolute right-0 bottom-0 size-3 rounded-full border-2 border-bg", online ? "bg-emerald-400" : "bg-muted/60")}
        />
      </div>
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold leading-tight">{friend.nickname}</h1>
        <p className={cn("truncate text-xs leading-tight", typing ? "font-bold text-[var(--accent)]" : "text-muted")} aria-live="polite">
          {sub}
        </p>
      </div>
    </header>
  );
}
