"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { NoteSheet } from "@/components/home/NoteSheet";
import { useFriendPresence } from "@/components/live/PresenceProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { useNow } from "@/hooks/useNow";
import { usePair } from "@/hooks/usePair";
import { useWeather } from "@/hooks/useWeather";
import { cn } from "@/lib/cn";
import { formatDistance, haversineKm } from "@/lib/geo";
import { noteLine, noteVisible } from "@/lib/notes";
import type { PresenceNode, UserDoc } from "@/lib/types";

function lastSeenLabel(presence: PresenceNode | null): string {
  if (!presence?.lastSeen) return "Not seen yet";
  const ago = formatDistanceToNowStrict(new Date(presence.lastSeen), { addSuffix: true });
  return `Last seen ${ago}`;
}

/**
 * Friend's face, online dot or last-seen, sleep badge, local time + weather;
 * then my time and the distance. Notes (phase 27) sit in speech bubbles over
 * the avatars: tap the friend's to reply in chat, tap yours to write one.
 */
export function PresenceCard({ friend }: { friend: UserDoc }) {
  const { uid, me } = usePair();
  const now = useNow(1000);
  const presence = useFriendPresence();
  const weather = useWeather(friend.lat, friend.lng);
  const router = useRouter();
  const [noteOpen, setNoteOpen] = useState(false);

  const online = presence?.online === true;
  const sleeping = presence?.status === "sleeping";
  const km = haversineKm(me.lat, me.lng, friend.lat, friend.lng);
  const nowMs = now.getTime();
  const friendNote = friend.note && noteVisible(friend.note, nowMs) ? friend.note : null;
  const myNote = me.note && noteVisible(me.note, nowMs) ? me.note : null;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <div className="flex shrink-0 flex-col items-start gap-1.5">
          {friendNote && (
            <NoteBubble side="left" label={`${friend.nickname}'s note, tap to reply`} onClick={() => router.push("/chat?quoteNote=1")}>
              {noteLine(friendNote)}
            </NoteBubble>
          )}
          <div className="relative">
            <Avatar user={friend} size={64} />
            <span
              aria-hidden
              className={cn(
                "absolute right-0 bottom-0 size-4 rounded-full border-2 border-surface",
                online ? "bg-emerald-400" : "bg-muted/60",
              )}
            />
          </div>
        </div>

        <div className="min-w-0 flex-1 self-center">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-2xl font-semibold">{friend.nickname}</h2>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-bold",
                sleeping ? "bg-indigo-500/15 text-indigo-500 dark:text-indigo-300" : "bg-amber-400/20 text-amber-700 dark:text-amber-300",
              )}
            >
              {sleeping ? "😴 Sleeping" : "☀️ Awake"}
            </span>
          </div>
          <p className={cn("text-sm", online ? "font-semibold text-emerald-600 dark:text-emerald-300" : "text-muted")}>
            {online ? "Online now" : lastSeenLabel(presence)}
          </p>
          {friend.bio && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{friend.bio}</p>}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <NoteBubble side="right" label={myNote ? "Your note, tap to change it" : "Leave a note"} onClick={() => setNoteOpen(true)} muted={!myNote}>
            {myNote ? noteLine(myNote) : "📝 Note…"}
          </NoteBubble>
          <button type="button" onClick={() => setNoteOpen(true)} aria-label="Write a note over your avatar" className="tap rounded-full">
            <Avatar user={me} size={40} />
          </button>
        </div>
      </div>

      <div className="flex items-stretch gap-3 rounded-2xl bg-surface-2 p-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">{friend.city}</p>
          <p className="font-heading text-2xl font-semibold tabular-nums">
            {formatInTimeZone(now, friend.tz, "h:mm:ss a")}
          </p>
        </div>
        <div className="flex items-center gap-2 text-right">
          {weather ? (
            <>
              <span className="text-3xl" aria-hidden>
                {weather.emoji}
              </span>
              <div>
                <p className="font-heading text-xl font-semibold">{weather.tempC}°</p>
                <p className="text-xs text-muted">{weather.label}</p>
              </div>
            </>
          ) : (
            <p className="self-center text-xs text-muted">Checking the sky…</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-1 text-sm text-muted">
        <span>
          You · <span className="font-semibold text-text tabular-nums">{formatInTimeZone(now, me.tz, "h:mm a")}</span>
        </span>
        <span>
          🧵 <span className="font-semibold text-text">{formatDistance(km)}</span> apart
        </span>
      </div>
      <NoteSheet open={noteOpen} uid={uid} current={myNote} onClose={() => setNoteOpen(false)} />
    </Card>
  );
}

/** A small speech bubble with its tail pointing down at the avatar beneath. */
function NoteBubble({ side, label, onClick, muted, children }: { side: "left" | "right"; label: string; onClick: () => void; muted?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "tap relative max-w-[150px] rounded-2xl px-2.5 py-1.5 text-left text-xs leading-snug shadow-sm",
        side === "left" ? "rounded-bl-md" : "rounded-br-md",
        muted ? "border border-dashed border-border text-muted" : "bg-accent-soft text-text",
      )}
    >
      <span className="line-clamp-2 break-words">{children}</span>
      {!muted && <span aria-hidden className={cn("absolute -bottom-1.5 size-3 rotate-45 bg-accent-soft", side === "left" ? "left-3" : "right-3")} />}
    </button>
  );
}
