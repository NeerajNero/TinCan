"use client";

import { AnimatePresence, m } from "framer-motion";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { Confetti } from "@/components/plan/Confetti";
import { CheckersBoard } from "@/components/play/boards/CheckersBoard";
import { ConnectFourBoard } from "@/components/play/boards/ConnectFourBoard";
import { TicTacToeBoard } from "@/components/play/boards/TicTacToeBoard";
import { CloseGameMenu } from "@/components/play/CloseGameMenu";
import { FriendHereBadge } from "@/components/play/FriendHereBadge";
import { ReactionBurst, ReactionRow } from "@/components/play/GameReactions";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { Splash } from "@/components/ui/Splash";
import type { HowToKey } from "@/content/howto";
import { useGameReactions } from "@/hooks/useGameReactions";
import { usePair } from "@/hooks/usePair";
import { cn } from "@/lib/cn";
import { acceptGame, declineGame, describeResult, gameRoute, isMyMove, playerOf, playMove, rematch, resign, subscribeGame, uidOf, type LiveGame } from "@/lib/db/games";
import type { GameType } from "@/lib/games";
import { engineFor } from "@/lib/games/all";
import type { BattleshipState } from "@/lib/games/battleship";
import { gameInfo } from "@/lib/games/catalog";
import { currentRound, type HangmanState } from "@/lib/games/hangman";
import { playSound } from "@/lib/sounds";

/** Board games share their how-to keys with the engine types. */
const HOWTO_FOR_GAME: Record<GameType, HowToKey> = { tictactoe: "tictactoe", connectfour: "connectfour", chess: "chess", checkers: "checkers", dots: "dots", hangman: "hangman", battleship: "battleship" };

// Each heavier board is its own chunk, loaded only when that game is open.
const boardSkeleton = () => <ListSkeleton rows={1} tall />;
const ChessBoard = dynamic(() => import("@/components/play/boards/ChessBoard").then((m) => m.ChessBoard), { ssr: false, loading: boardSkeleton });
const DotsBoard = dynamic(() => import("@/components/play/boards/DotsBoard").then((m) => m.DotsBoard), { ssr: false, loading: boardSkeleton });
const HangmanBoard = dynamic(() => import("@/components/play/boards/HangmanBoard").then((m) => m.HangmanBoard), { ssr: false, loading: boardSkeleton });
const BattleshipBoard = dynamic(() => import("@/components/play/boards/BattleshipBoard").then((m) => m.BattleshipBoard), { ssr: false, loading: boardSkeleton });

/** Seat labels per game: chess has colours, Hangman swaps roles each round. */
function seatLabels(type: GameType, state: unknown): [string, string] {
  if (type === "chess") return ["White", "Black"];
  if (type === "hangman" && state) {
    const setter = currentRound(state as HangmanState).setter;
    return setter === "first" ? ["Setter", "Guesser"] : ["Guesser", "Setter"];
  }
  return ["First", "Second"];
}
export function GameScreen({ gameId }: { gameId: string }) {
  const { uid, me, friend } = usePair();
  const router = useRouter();
  const autoJoin = useSearchParams().get("join") === "1";
  const [game, setGame] = useState<LiveGame | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState(0);
  const celebrated = useRef(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const { live: reactions, react } = useGameReactions(gameId, uid);

  useEffect(() => {
    const unsub = subscribeGame(gameId, (g) => setGame(g));
    return () => unsub();
  }, [gameId]);

  // Arrived through an invite's Join: accept without the extra tap (once).
  const joinedRef = useRef(false);
  useEffect(() => {
    if (!autoJoin || joinedRef.current || !game || game.status !== "invited" || game.createdBy === uid) return;
    joinedRef.current = true;
    void acceptGame(game.id);
  }, [autoJoin, game, uid]);

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
      playSound("win");
    }
  }, [game?.status, game?.winnerId, uid]);

  if (game === undefined) return <Splash label="Setting up the board…" inline />;
  if (game === null) {
    return (
      <div className="flex flex-col gap-4">
        <SubHeader emoji="🎲" title="Game" back="/play" />
        <Card className="py-8 text-center text-muted">This game is gone.</Card>
      </div>
    );
  }

  const meta = gameInfo(game.type);
  const mine = playerOf(game, uid);
  const myTurn = isMyMove(game, uid);
  const canMove = myTurn && !busy;
  const [firstLabel, secondLabel] = seatLabels(game.type, state);
  const placing = game.type === "battleship" && game.status === "active" && (state as BattleshipState | null)?.phase === "placing";
  const names = { first: nameOf(game.players.first), second: nameOf(game.players.second) };

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
      <SubHeader emoji={meta.emoji} title={meta.name} back="/play" help={HOWTO_FOR_GAME[game.type]} invite={game.status === "finished" || game.status === "declined" ? undefined : { activity: game.type, route: gameRoute(game.id), label: `a game of ${meta.name}`, roundId: game.id }} />

      {/* sticky turn header */}
      <div className="sticky top-0 z-10 -mx-4 bg-bg/90 px-4 py-2 backdrop-blur-md">
        <div className="card flex items-center gap-3 rounded-[20px] px-3 py-2">
          <CloseGameMenu game={game} onDone={() => router.push("/play")} className="tap grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2" />
          <Seat uid={game.players.first} label={firstLabel} active={game.status === "active" && (placing ? isMyMove(game, game.players.first) : game.turn === "first")} me={uid} meDoc={me} friendDoc={friend} nameOf={nameOf} />
          <span className="text-xs font-bold text-muted">vs</span>
          <Seat uid={game.players.second} label={secondLabel} active={game.status === "active" && (placing ? isMyMove(game, game.players.second) : game.turn === "second")} me={uid} meDoc={me} friendDoc={friend} nameOf={nameOf} right />
        </div>
        <p className="pt-1 text-center text-sm font-bold" aria-live="polite">
          {game.status === "invited" && (game.createdBy === uid ? `Waiting for ${nameOf(game.players.second)} to accept…` : `${nameOf(game.createdBy)} invited you`)}
          {game.status === "active" && placing && (myTurn ? "Place your ships" : `Waiting for ${nameOf(uidOf(game, game.turn))} to place ships`)}
          {game.status === "active" && !placing && (myTurn ? "Your turn" : `${nameOf(uidOf(game, game.turn))}'s turn`)}
          {game.status === "finished" && (game.winnerId ? (game.winnerId === uid ? "You won! 🎉" : `${nameOf(game.winnerId)} won`) : game.endReason === "abandoned" ? "Abandoned" : game.endReason === "cancelled" ? "Cancelled" : "Draw")}
          {game.status === "declined" && "Declined"}
        </p>
        <FriendHereBadge invite={game.status === "finished" || game.status === "declined" ? undefined : { activity: game.type, route: gameRoute(game.id), label: `a game of ${meta.name}`, roundId: game.id }} />
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
        <ReactionBurst live={reactions} uid={uid} nameOf={nameOf} />
        {game.type === "tictactoe" && <TicTacToeBoard state={state} canMove={canMove} legal={legal} line={result?.line} onMove={move} />}
        {game.type === "connectfour" && <ConnectFourBoard state={state} canMove={canMove} legal={legal} line={result?.line} onMove={move} />}
        {game.type === "checkers" && <CheckersBoard state={state} me={mine} canMove={canMove} legal={legal} onMove={move} />}
        {game.type === "chess" && <ChessBoard state={state} me={mine} canMove={canMove} legal={legal} onMove={move} />}
        {game.type === "dots" && <DotsBoard state={state} me={mine} canMove={canMove} legal={legal} names={names} onMove={move} />}
        {game.type === "hangman" && <HangmanBoard game={game} state={state} me={mine} uid={uid} nameOf={nameOf} />}
        {game.type === "battleship" && <BattleshipBoard game={game} state={state} me={mine} uid={uid} nameOf={nameOf} />}
      </div>

      {game.status === "active" && mine && <ReactionRow onReact={react} />}

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
          <m.div key="done" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="flex flex-col items-center gap-3 text-center">
              <p className="font-heading text-xl font-semibold">{describeResult(game, nameOf)}</p>
              <Button onClick={() => void rematch(game).then((id) => router.push(gameRoute(id)))} className="px-6">
                Rematch
              </Button>
            </Card>
          </m.div>
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
