"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { Palette } from "lucide-react";
import { useState } from "react";

import { ChatBackgroundPicker } from "@/components/chat/ChatBackgroundPicker";
import { useFriendPresence } from "@/components/live/PresenceProvider";
import { Avatar } from "@/components/ui/Avatar";
import { usePair } from "@/hooks/usePair";
import { useFriendTyping } from "@/hooks/useTyping";
import { cn } from "@/lib/cn";
import type { UserDoc } from "@/lib/types";

/** Friend's name, presence and typing state, plus the background picker. Presence and typing live in their own subscriptions so the list below never re-renders for them. */
export function ChatHeader({ friend, friendUid }: { friend: UserDoc; friendUid: string }) {
  const presence = useFriendPresence();
  const { uid, me } = usePair();
  const [pickerOpen, setPickerOpen] = useState(false);
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
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold leading-tight">{friend.nickname}</h1>
        <p className={cn("truncate text-xs leading-tight", typing ? "font-bold text-[var(--accent)]" : "text-muted")} aria-live="polite">
          {sub}
        </p>
      </div>
      <button type="button" onClick={() => setPickerOpen(true)} aria-label="Chat background" className="tap grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2">
        <Palette size={20} />
      </button>
      <ChatBackgroundPicker open={pickerOpen} uid={uid} current={me.chatBg} onClose={() => setPickerOpen(false)} />
    </header>
  );
}
