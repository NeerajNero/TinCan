"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { CheckersBoard } from "@/components/play/boards/CheckersBoard";
import dynamic from "next/dynamic";

import { ListSkeleton } from "@/components/ui/Skeleton";

const ChessBoard = dynamic(() => import("@/components/play/boards/ChessBoard").then((m) => m.ChessBoard), { ssr: false, loading: () => <ListSkeleton rows={1} tall /> });
import { ConnectFourBoard } from "@/components/play/boards/ConnectFourBoard";
import { TicTacToeBoard } from "@/components/play/boards/TicTacToeBoard";
import { CloseGameMenu } from "@/components/play/CloseGameMenu";
import { FriendHereBadge } from "@/components/play/FriendHereBadge";
import { Confetti } from "@/components/plan/Confetti";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Splash } from "@/components/ui/Splash";
import { usePair } from "@/hooks/usePair";
import { cn } from "@/lib/cn";
import { acceptGame, declineGame, describeResult, GAME_REACTIONS, gameRoute, playerOf, playMove, rematch, resign, sendReaction, subscribeGame, uidOf, type LiveGame } from "@/lib/db/games";
import { engineFor, GAME_META } from "@/lib/games";
import { playSound } from "@/lib/sounds";

export function GameScreen({ gameId }: { gameId: string }) {
  const { uid, me, friend } = usePair();
  const router = useRouter();
  const [game, setGame] = useState<LiveGame | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState(0);
  const celebrated = useRef(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [floating, setFloating] = useState<{ emoji: string; by: string; at: number } | null>(null);
  const lastReactionAt = useRef<number | null>(null);

  useEffect(() => {
    const unsub = subscribeGame(gameId, (g) => setGame(g));
    return () => unsub();
  }, [gameId]);

  const nameOf = (id: string) => (id === uid ? me.nickname : (friend?.nickname ?? "Friend"));
  const engine = game ? engineFor(game.type) : null;
  const state = useMemo(() => (game ? JSON.parse(game.state) : null), [game]);
  const legal = useMemo(() => (engine && state && game?.status === "active" ? engine.legalMoves(state) : []), [engine, state, game?.status]);
  const result = useMemo(() => (engine && state ? engine.status(state) : null), [engine, state]);

  // Reactions: animate every change after the first snapshot.
  const reaction = game?.reaction ?? null;
  useEffect(() => {
    if (!reaction) return;
    if (lastReactionAt.current === null) {
      lastReactionAt.current = reaction.at;
      return;
    }
    if (reaction.at === lastReactionAt.current) return;
    lastReactionAt.current = reaction.at;
    setFloating(reaction);
    try {
      navigator.vibrate?.(20);
    } catch {
      // no haptics
    }
    const t = setTimeout(() => setFloating(null), 1800);
    return () => clearTimeout(t);
  }, [reaction]);

  // Confetti once for the winner.
  useEffect(() => {
    if (game?.status === "finished" && game.winnerId === uid && !celebrated.current) {
      celebrated.current = true;
      setBurst((b) => b + 1);
      playSound("win");
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
          <CloseGameMenu game={game} onDone={() => router.push("/play")} className="tap grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2" />
          <Seat uid={game.players.first} label={game.type === "chess" ? "White" : "First"} active={game.status === "active" && game.turn === "first"} me={uid} meDoc={me} friendDoc={friend} nameOf={nameOf} />
          <span className="text-xs font-bold text-muted">vs</span>
          <Seat uid={game.players.second} label={game.type === "chess" ? "Black" : "Second"} active={game.status === "active" && game.turn === "second"} me={uid} meDoc={me} friendDoc={friend} nameOf={nameOf} right />
        </div>
        <p className="pt-1 text-center text-sm font-bold" aria-live="polite">
          {game.status === "invited" && (game.createdBy === uid ? `Waiting for ${nameOf(game.players.second)} to accept…` : `${nameOf(game.createdBy)} invited you`)}
          {game.status === "active" && (myTurn ? "Your turn" : `${nameOf(uidOf(game, game.turn))}'s turn`)}
          {game.status === "finished" && (game.winnerId ? (game.winnerId === uid ? "You won! 🎉" : `${nameOf(game.winnerId)} won`) : game.endReason === "abandoned" ? "Abandoned" : game.endReason === "cancelled" ? "Cancelled" : "Draw")}
          {game.status === "declined" && "Declined"}
        </p>
        <FriendHereBadge screenName={meta.name} />
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

      <div className={cn("relative", game.status !== "active" && game.status !== "finished" && "pointer-events-none opacity-60")}>
        <AnimatePresence>
          {floating && (
            <motion.div
              key={floating.at}
              aria-live="polite"
              className="pointer-events-none absolute inset-x-0 top-1/3 z-20 flex flex-col items-center"
              initial={{ scale: 0.4, opacity: 0, y: 20 }}
              animate={{ scale: [0.4, 1.4, 1.1], opacity: [0, 1, 1], y: [20, -10, -40] }}
              exit={{ opacity: 0, y: -80 }}
              transition={{ duration: 0.9, ease: "easeOut", times: [0, 0.4, 1] }}
            >
              <span className="text-7xl drop-shadow-lg">{floating.emoji}</span>
              <span className="mt-1 rounded-full bg-surface/90 px-2 py-0.5 text-xs font-bold shadow">{floating.by === uid ? "You" : nameOf(floating.by)}</span>
            </motion.div>
          )}
        </AnimatePresence>
        {game.type === "tictactoe" && <TicTacToeBoard state={state} canMove={canMove} legal={legal} line={result?.line} onMove={move} />}
        {game.type === "connectfour" && <ConnectFourBoard state={state} canMove={canMove} legal={legal} line={result?.line} onMove={move} />}
        {game.type === "checkers" && <CheckersBoard state={state} me={mine} canMove={canMove} legal={legal} onMove={move} />}
        {game.type === "chess" && <ChessBoard state={state} me={mine} canMove={canMove} legal={legal} onMove={move} />}
      </div>

      {game.status === "active" && mine && (
        <div role="group" aria-label="React" className="flex justify-center gap-2">
          {GAME_REACTIONS.map((e) => (
            <motion.button key={e} type="button" whileTap={{ scale: 0.8 }} onClick={() => void sendReaction(game.id, uid, e)} aria-label={`React ${e}`} className="tap grid size-11 place-items-center rounded-full bg-surface text-2xl shadow-sm">
              {e}
            </motion.button>
          ))}
        </div>
      )}

      {game.status === "active" && mine && !confirmResign && (
        <Button variant="ghost" onClick={() => setConfirmResign(true)} className="self-center text-sm text-muted">
          Resign
        </Button>
      )}
      {game.status === "active" && mine && confirmResign && (
        <Card className="flex items-center gap-2">
          <p className="min-w-0 flex-1 text-sm">Resign this game? {nameOf(uidOf(game, mine === "first" ? "second" : "first"))} takes the win.</p>
          <Button variant="ghost" onClick={() => setConfirmResign(false)} className="px-3 py-2 text-sm">
            Keep playing
          </Button>
          <Button onClick={() => { setConfirmResign(false); void resign(game, uid, nameOf); }} className="bg-red-500 px-4 py-2 text-sm text-white">
            Resign
          </Button>
        </Card>
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
