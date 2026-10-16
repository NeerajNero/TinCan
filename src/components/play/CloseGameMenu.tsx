"use client";

import { X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { usePair } from "@/hooks/usePair";
import { cancelGame, declineGame, playerOf, resign, type LiveGame } from "@/lib/db/games";
import { gameInfo } from "@/lib/games/catalog";
/**
 * The ✕ on a game row or header. What it offers depends on the game:
 * an invite I sent → cancel it; an active game with no moves → cancel it;
 * otherwise → resign, which counts as a loss.
 */
export function CloseGameMenu({ game, onDone, className }: { game: LiveGame; onDone?: () => void; className?: string }) {
  const { uid, me, friend } = usePair();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const nameOf = (id: string) => (id === uid ? me.nickname : (friend?.nickname ?? "Friend"));
  const mine = playerOf(game, uid);
  const meta = gameInfo(game.type);

  const kind: "invite" | "cancel" | "resign" | null =
    game.status === "invited" ? (game.createdBy === uid ? "invite" : null) : game.status === "active" && mine ? ((game.moves ?? 0) === 0 ? "cancel" : "resign") : null;
  if (!kind) return null;

  const copy = {
    invite: { title: "Cancel the invite?", body: `${nameOf(game.players.second)} won't see it any more.`, action: "Cancel invite" },
    cancel: { title: `Cancel the ${meta.name} game?`, body: "Nobody has moved yet, so nothing is recorded.", action: "Cancel game" },
    resign: { title: `Resign the ${meta.name} game?`, body: `${nameOf(game.players.first === uid ? game.players.second : game.players.first)} takes the win and it counts in your record.`, action: "Resign (counts as a loss)" },
  }[kind];

  async function confirm() {
    setBusy(true);
    try {
      if (kind === "invite") await declineGame(game.id);
      else if (kind === "cancel") await cancelGame(game, uid, nameOf);
      else await resign(game, uid, nameOf);
      setOpen(false);
      onDone?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={copy.action}
        className={className ?? "tap grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2"}
      >
        <X size={16} />
      </button>
            <Sheet open={open} onClose={() => setOpen(false)} label={copy.title} className="flex flex-col gap-3 px-5">
              <p className="font-heading text-lg font-semibold">{copy.title}</p>
              <p className="text-sm text-muted">{copy.body}</p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                  Keep playing
                </Button>
                <Button onClick={() => void confirm()} disabled={busy} className={kind === "resign" ? "bg-red-500 text-white" : ""}>
                  {busy ? "…" : copy.action}
                </Button>
              </div>
            </Sheet>
    </>
  );
}
