"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { Palette } from "lucide-react";
import { useState } from "react";

import { ChatBackgroundPicker } from "@/components/chat/ChatBackgroundPicker";
import { useFriendPresence } from "@/components/live/PresenceProvider";
import { useHeader } from "@/components/shell/HeaderProvider";
import { Avatar } from "@/components/ui/Avatar";
import { usePair } from "@/hooks/usePair";
import { useFriendTyping } from "@/hooks/useTyping";
import { cn } from "@/lib/cn";
import type { UserDoc } from "@/lib/types";

/**
 * Chat's header, declared onto the persistent app header: the friend's avatar
 * with the online dot on the left, their name, presence / "typing…" in the
 * subtitle slot, and the background picker as the action. Presence and typing
 * live in their own subscriptions so the list never re-renders for them. The
 * picker sheet is the only thing this renders in place.
 */
export function ChatHeader({ friend, friendUid }: { friend: UserDoc; friendUid: string }) {
  const presence = useFriendPresence();
  const { uid, pair } = usePair();
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

  useHeader({
    title: friend.nickname,
    leading: (
      <span className="relative mx-1 shrink-0">
        <Avatar user={friend} size={36} />
        <span aria-hidden className={cn("absolute right-0 bottom-0 size-3 rounded-full border-2 border-bg", online ? "bg-emerald-400" : "bg-muted/60")} />
      </span>
    ),
    subtitle: sub ? (
      <span className={cn(typing && "font-bold text-[var(--accent)]")} aria-live="polite">
        {sub}
      </span>
    ) : undefined,
    actions: (
      <button type="button" onClick={() => setPickerOpen(true)} aria-label="Chat background" className="tap grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2">
        <Palette size={20} />
      </button>
    ),
  });

  return <ChatBackgroundPicker open={pickerOpen} uid={uid} friendName={friend.nickname} current={pair.chatBg} onClose={() => setPickerOpen(false)} />;
}
