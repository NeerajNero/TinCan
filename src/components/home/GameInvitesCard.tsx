"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useLiveEvents } from "@/components/live/LiveEventsProvider";
import { Button } from "@/components/ui/Button";
import { usePair } from "@/hooks/usePair";
import { acceptGame, declineGame, gameRoute, uidOf } from "@/lib/db/games";
import { GAME_META } from "@/lib/games";

/** Invites waiting on me, and games where it's my move. */
export function GameInvitesCard({ friendName }: { friendName: string }) {
  const { uid } = usePair();
  const { games } = useLiveEvents();
  const router = useRouter();
  const invites = games.filter((g) => g.status === "invited" && g.createdBy !== uid);
  const myTurn = games.filter((g) => g.status === "active" && uidOf(g, g.turn) === uid);
  if (invites.length === 0 && myTurn.length === 0) return null;

  return (
    <div className="flex flex-col gap-2" style={{ "--accent": "var(--accent-play)" } as React.CSSProperties}>
      {invites.map((g) => (
        <div key={g.id} className="card flex items-center gap-3 rounded-[24px] px-4 py-3">
          <span className="text-3xl" aria-hidden>
            {GAME_META[g.type].emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-heading font-semibold">{friendName} wants to play</span>
            <span className="block text-xs text-muted">{GAME_META[g.type].name}</span>
          </span>
          <Button variant="ghost" onClick={() => void declineGame(g.id)} className="px-3 py-2 text-sm">
            No
          </Button>
          <Button onClick={() => void acceptGame(g.id).then(() => router.push(gameRoute(g.id)))} className="px-4 py-2 text-sm">
            Play
          </Button>
        </div>
      ))}
      {myTurn.map((g) => (
        <Link key={g.id} href={gameRoute(g.id)} className="card tap flex items-center gap-3 rounded-[24px] px-4 py-3">
          <span className="text-3xl" aria-hidden>
            {GAME_META[g.type].emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-heading font-semibold">Your move</span>
            <span className="block text-xs text-muted">{GAME_META[g.type].name} · {g.moves} moves in</span>
          </span>
          <span className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-bold text-white">Go</span>
        </Link>
      ))}
    </div>
  );
}
