"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { CheckersBoard } from "@/components/play/boards/CheckersBoard";
import { ChessBoard } from "@/components/play/boards/ChessBoard";
import { ConnectFourBoard } from "@/components/play/boards/ConnectFourBoard";
import { TicTacToeBoard } from "@/components/play/boards/TicTacToeBoard";
import { Confetti } from "@/components/plan/Confetti";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Splash } from "@/components/ui/Splash";
import { usePair } from "@/hooks/usePair";
import { cn } from "@/lib/cn";
import { acceptGame, declineGame, describeResult, gameRoute, playerOf, playMove, rematch, resign, subscribeGame, uidOf, type LiveGame } from "@/lib/db/games";
import { engineFor, GAME_META } from "@/lib/games";

export function GameScreen({ gameId }: { gameId: string }) {
  const { uid, me, friend } = usePair();
  const router = useRouter();
  const [game, setGame] = useState<LiveGame | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState(0);
  const celebrated = useRef(false);

  useEffect(() => {
    const unsub = subscribeGame(gameId, (g) => setGame(g));
    return () => unsub();
  }, [gameId]);

  const nameOf = (id: string) => (id === uid ? me.nickname : (friend?.nickname ?? "Friend"));
  const engine = game ? engineFor(game.type) : null;
  const state = useMemo(() => (game ? JSON.parse(game.state) : null), [game]);
  const legal = useMemo(() => (engine && state && game?.status === "active" ? engine.legalMoves(state) : []), [engine, state, game?.status]);
  const result = useMemo(() => (engine && state ? engine.status(state) : null), [engine, state]);

  // Confetti once for the winner.
  useEffect(() => {
    if (game?.status === "finished" && game.winnerId === uid && !celebrated.current) {
      celebrated.current = true;
      setBurst((b) => b + 1);
    }
  }, [game?.status, game?.winnerId, uid]);

  if (game === undefined) return <Splash label="Setting up the board…" />;
  if (game === null) {
    return (
      <div className="flex flex-col gap-4">
        <SubHeader emoji="🎲" title="Game" back="/play" />
        <Card className="py-8 text-center text-muted">This game is gone.</Card>
      </div>
    );
  }

  const meta = GAME_META[game.type];
  const mine = playerOf(game, uid);
  const myTurn = game.status === "active" && uidOf(game, game.turn) === uid;
  const canMove = myTurn && !busy;

  async function move(m: unknown) {
    if (!game || !canMove) return;
    setBusy(true);
    try {
      await playMove(game, uid, m, nameOf);
    } catch {
      // Rejected (stale turn); the listener will refresh.
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SubHeader emoji={meta.emoji} title={meta.name} back="/play" />

      {/* sticky turn header */}
      <div className="sticky top-0 z-10 -mx-4 bg-bg/90 px-4 py-2 backdrop-blur-md">
        <div className="card flex items-center gap-3 rounded-[20px] px-3 py-2">
          <Seat uid={game.players.first} label={game.type === "chess" ? "White" : "First"} active={game.status === "active" && game.turn === "first"} me={uid} meDoc={me} friendDoc={friend} nameOf={nameOf} />
          <span className="text-xs font-bold text-muted">vs</span>
          <Seat uid={game.players.second} label={game.type === "chess" ? "Black" : "Second"} active={game.status === "active" && game.turn === "second"} me={uid} meDoc={me} friendDoc={friend} nameOf={nameOf} right />
        </div>
        <p className="pt-1 text-center text-sm font-bold" aria-live="polite">
          {game.status === "invited" && (game.createdBy === uid ? `Waiting for ${nameOf(game.players.second)} to accept…` : `${nameOf(game.createdBy)} invited you`)}
          {game.status === "active" && (myTurn ? "Your turn" : `${nameOf(uidOf(game, game.turn))}'s turn`)}
          {game.status === "finished" && (game.winnerId ? (game.winnerId === uid ? "You won! 🎉" : `${nameOf(game.winnerId)} won`) : game.endReason === "abandoned" ? "Abandoned" : "Draw")}
          {game.status === "declined" && "Declined"}
        </p>
      </div>

      {game.status === "invited" && game.createdBy !== uid && (
        <Card className="flex items-center gap-2">
          <p className="min-w-0 flex-1 text-sm">Up for a game of {meta.name}?</p>
          <Button variant="ghost" onClick={() => void declineGame(game.id).then(() => router.push("/play"))} className="px-3 py-2 text-sm">
            Decline
          </Button>
          <Button onClick={() => void acceptGame(game.id)} className="px-4 py-2 text-sm">
            Accept
          </Button>
        </Card>
      )}

      <div className={cn(game.status !== "active" && game.status !== "finished" && "pointer-events-none opacity-60")}>
        {game.type === "tictactoe" && <TicTacToeBoard state={state} canMove={canMove} legal={legal} line={result?.line} onMove={move} />}
        {game.type === "connectfour" && <ConnectFourBoard state={state} canMove={canMove} legal={legal} line={result?.line} onMove={move} />}
        {game.type === "checkers" && <CheckersBoard state={state} me={mine} canMove={canMove} legal={legal} onMove={move} />}
        {game.type === "chess" && <ChessBoard state={state} me={mine} canMove={canMove} legal={legal} onMove={move} />}
      </div>

      {game.status === "active" && mine && (
        <Button variant="ghost" onClick={() => void resign(game, uid, nameOf)} className="self-center text-sm text-muted">
          Resign
        </Button>
      )}

      <AnimatePresence>
        {game.status === "finished" && (
          <motion.div key="done" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="flex flex-col items-center gap-3 text-center">
              <p className="font-heading text-xl font-semibold">{describeResult(game, nameOf)}</p>
              <Button onClick={() => void rematch(game).then((id) => router.push(gameRoute(id)))} className="px-6">
                Rematch
              </Button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      <Confetti burst={burst} />
    </div>
  );
}

function Seat({ uid: seatUid, label, active, me, meDoc, friendDoc, nameOf, right }: { uid: string; label: string; active: boolean; me: string; meDoc: Parameters<typeof Avatar>[0]["user"]; friendDoc: Parameters<typeof Avatar>[0]["user"] | null; nameOf: (u: string) => string; right?: boolean }) {
  const doc = seatUid === me ? meDoc : friendDoc;
  return (
    <div className={cn("flex min-w-0 flex-1 items-center gap-2", right && "flex-row-reverse text-right")}>
      <span className={cn("rounded-full", active && "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-surface")}>{doc ? <Avatar user={doc} size={32} /> : <span className="block size-8 rounded-full bg-surface-2" />}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{nameOf(seatUid)}</span>
        <span className="block text-[10px] text-muted">{label}</span>
      </span>
    </div>
  );
}
