"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { usePathname } from "next/navigation";

import { useLiveEvents } from "@/components/live/LiveEventsProvider";
import { useFriendPresence } from "@/components/live/PresenceProvider";
import { InviteButton, type InviteSpec } from "@/components/play/InviteButton";
import { usePair } from "@/hooks/usePair";
import { cn } from "@/lib/cn";
import { gameRoute } from "@/lib/db/games";
import { DECK_META, type DeckKind } from "@/lib/deckMeta";
import { gameInfo } from "@/lib/games/catalog";

const LABELS: Array<[RegExp, string]> = [
  [/^\/$/, "on Home"],
  [/^\/chat/, "on Chat"],
  [/^\/play\/whiteboard/, "on the whiteboard"],
  [/^\/play\/pixel/, "doing pixel art"],
  [/^\/play\/pictionary/, "playing Pictionary"],
  [/^\/play\/watch/, "watching something"],
  [/^\/play\/listen/, "listening to music"],
  [/^\/play\/radio/, "on the radio"],
  [/^\/play\/timer/, "in a focus session"],
  [/^\/play\/cook/, "cooking"],
  [/^\/play\/twenty/, "playing 20 Questions"],
  [/^\/play\/wheel/, "spinning the wheel"],
  [/^\/play\/trivia/, "in a trivia duel"],
  [/^\/play\/quiz/, "on a know-me quiz"],
  [/^\/play\/word/, "on the daily word"],
  [/^\/play\/?$/, "in Play"],
  [/^\/memories/, "in Memories"],
  [/^\/plan/, "in Plan"],
  [/^\/more/, "in More"],
  [/^\/pet/, "with the pet"],
];

/**
 * One line under a game's header: here · elsewhere (with a compact Invite,
 * the same `startInvite` as the header button) · offline. No listeners of its own.
 */
export function FriendHereBadge({ invite }: { invite?: InviteSpec }) {
  const { friend, friendUid } = usePair();
  const { games } = useLiveEvents();
  const friendPresence = useFriendPresence();
  const pathname = usePathname();
  if (!friend || !friendUid) return null;

  const name = friend.nickname;
  const online = friendPresence?.online === true;
  const page = friendPresence?.page ?? "";
  const here = online && page === pathname;

  function labelFor(p: string): string {
    const deck = p.match(/^\/play\/deck\/(\w+)/)?.[1] as DeckKind | undefined;
    if (deck && DECK_META[deck]) return `playing ${DECK_META[deck].name}`;
    const game = games.find((g) => gameRoute(g.id) === p);
    if (game) return `playing ${gameInfo(game.type).name}`;
    return LABELS.find(([re]) => re.test(p))?.[1] ?? "somewhere in Tincan";
  }

  return (
    <p className={cn("flex items-center gap-2 px-1 text-xs", here ? "font-bold text-[var(--accent)]" : "text-muted")} aria-live="polite">
      <span aria-hidden>{online ? "●" : "○"}</span>
      <span className="min-w-0 truncate">
        {here ? `${name} is here` : online ? `${name} is ${labelFor(page)}` : friendPresence?.lastSeen ? `last seen ${formatDistanceToNowStrict(new Date(friendPresence.lastSeen), { addSuffix: true })}` : `${name} is offline`}
      </span>
      {online && !here && invite && <InviteButton spec={invite} compact />}
    </p>
  );
}
