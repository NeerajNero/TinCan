"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { useNow } from "@/hooks/useNow";
import { usePair } from "@/hooks/usePair";
import { useRtdbValue } from "@/hooks/useRtdbValue";
import { useWeather } from "@/hooks/useWeather";
import { cn } from "@/lib/cn";
import { formatDistance, haversineKm } from "@/lib/geo";
import { presencePath } from "@/lib/rtdb";
import type { PresenceNode, UserDoc } from "@/lib/types";

function lastSeenLabel(presence: PresenceNode | null): string {
  if (!presence?.lastSeen) return "Not seen yet";
  const ago = formatDistanceToNowStrict(new Date(presence.lastSeen), { addSuffix: true });
  return `Last seen ${ago}`;
}

/** Friend's face, online dot or last-seen, sleep badge, local time + weather; then my time and the distance. */
export function PresenceCard({ friend }: { friend: UserDoc }) {
  const { me, friendUid } = usePair();
  const now = useNow(1000);
  const { value: presence } = useRtdbValue<PresenceNode>(friendUid ? presencePath(friendUid) : null);
  const weather = useWeather(friend.lat, friend.lng);

  const online = presence?.online === true;
  const sleeping = presence?.status === "sleeping";
  const km = haversineKm(me.lat, me.lng, friend.lat, friend.lng);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <Avatar user={friend} size={64} />
          <span
            aria-hidden
            className={cn(
              "absolute right-0 bottom-0 size-4 rounded-full border-2 border-surface",
              online ? "bg-emerald-400" : "bg-muted/60",
            )}
          />
        </div>

        <div className="min-w-0 flex-1">
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
    </Card>
  );
}
