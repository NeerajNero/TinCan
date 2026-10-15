"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { CANVAS_COLORS, CANVAS_WIDTHS, SharedCanvas, type Tool } from "@/components/play/together/SharedCanvas";
import { ToolBtn } from "@/components/play/together/WhiteboardScreen";
import { Confetti } from "@/components/plan/Confetti";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useNow } from "@/hooks/useNow";
import { usePair } from "@/hooks/usePair";
import { useRtdbValue } from "@/hooks/useRtdbValue";
import { cn } from "@/lib/cn";
import { recordGenericResult } from "@/lib/db/games";
import { acceptPictionary, chooseWord, closePictionary, declinePictionary, endRound, invitePictionary, nextRound, parseGuesses, parseOptions, pictRoute, ROUND_MS, ROUNDS, submitGuess, subscribeOpenPictionary, subscribePictionary, type LivePictionary } from "@/lib/db/pictionary";
import { recordTogetherEvent } from "@/lib/garden";
import { Eraser, Pen } from "lucide-react";

export function PictionaryLobby() {
  const { uid, me, friend, friendUid } = usePair();
  const router = useRouter();
  const [open, setOpen] = useState<LivePictionary[]>([]);
  const [busy, setBusy] = useState(false);
  const nameOf = (id: string) => (id === uid ? me.nickname : (friend?.nickname ?? "Friend"));
  useEffect(() => subscribeOpenPictionary(setOpen), []);
  const live = open.find((g) => g.status === "invited" || g.status === "active");

  async function invite() {
    if (!friendUid || busy) return;
    setBusy(true);
    try {
      const id = await invitePictionary(uid, friendUid);
      router.push(pictRoute(id));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SubHeader emoji="🎨" title="Pictionary" back="/play" />
      <Card className="flex flex-col gap-3">
        <p className="text-sm text-muted">Three rounds, 60 seconds each, drawer alternates. The guesser types; the drawer draws.</p>
        {live ? (
          <Button onClick={() => router.push(pictRoute(live.id))}>{live.status === "invited" ? (live.createdBy === uid ? "Waiting for them — open" : `${nameOf(live.createdBy)} invited you — open`) : "Rejoin the game"}</Button>
        ) : (
          <Button onClick={() => void invite()} disabled={!friendUid || busy}>
            {busy ? "Inviting…" : `Invite ${friend?.nickname ?? "friend"}`}
          </Button>
        )}
      </Card>
    </div>
  );
}

export function PictionaryGame({ id }: { id: string }) {
  const { uid, me, friend } = usePair();
  const router = useRouter();
  const [game, setGame] = useState<LivePictionary | null | undefined>(undefined);
  const { value: offset } = useRtdbValue<number>(".info/serverTimeOffset");
  const now = useNow(250);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState<string>(CANVAS_COLORS[0]);
  const [width, setWidth] = useState<number>(CANVAS_WIDTHS[1]);
  const [guess, setGuess] = useState("");
  const [burst, setBurst] = useState(0);
  const finished = useRef(false);
  const timedOut = useRef<number | null>(null);
  const nameOf = (who: string) => (who === uid ? me.nickname : (friend?.nickname ?? "Friend"));

  useEffect(() => subscribePictionary(id, setGame), [id]);

  const drawer = game?.drawerUid === uid;
  const serverNow = now.getTime() + (offset ?? 0);
  const left = game?.word && !game.roundOver ? Math.max(0, game.roundStartedAt + ROUND_MS - serverNow) : 0;

  // Timer expiry → close the round (either client; idempotent).
  useEffect(() => {
    if (!game?.word || game.roundOver || left > 0 || timedOut.current === game.roundStartedAt) return;
    timedOut.current = game.roundStartedAt;
    void endRound(game.id);
  }, [game, left]);

  // Finished → results once (by the first player).
  useEffect(() => {
    if (!game || game.status !== "finished" || finished.current) return;
    finished.current = true;
    recordTogetherEvent("pictionary");
    const a = game.players.first;
    const b = game.players.second;
    const sa = game.scores[a] ?? 0;
    const sb = game.scores[b] ?? 0;
    const winnerId = sa === sb ? null : sa > sb ? a : b;
    if (winnerId === uid) setTimeout(() => setBurst(1), 0);
    if (uid === a) void recordGenericResult("pictionary", [a, b], winnerId, game.createdAt || Date.now(), ROUNDS, nameOf).then(() => closePictionary(game.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.status]);

  if (game === undefined) return <Card className="py-8 text-center text-muted">Loading…</Card>;
  if (game === null) return <Card className="py-8 text-center text-muted">This game is gone.</Card>;

  const guesses = parseGuesses(game);
  const options = parseOptions(game);

  async function sendGuess() {
    if (!game || !guess.trim()) return;
    const text = guess;
    setGuess("");
    const hit = await submitGuess(game, uid, text);
    if (hit) setBurst((b) => b + 1);
  }

  return (
    <div className="-mb-6 flex min-h-0 flex-1 flex-col gap-3">
      <SubHeader emoji="🎨" title={`Pictionary · round ${Math.min(game.round, ROUNDS)}/${ROUNDS}`} back="/play/pictionary" />

      <div className="card flex items-center gap-3 rounded-[20px] px-3 py-2">
        <span className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">{nameOf(game.players.first)}</span> {game.scores[game.players.first] ?? 0} · <span className="font-semibold">{nameOf(game.players.second)}</span> {game.scores[game.players.second] ?? 0}
        </span>
        {game.word && !game.roundOver && <span className={cn("font-heading text-xl font-semibold tabular-nums", left < 10_000 && "text-red-500")}>{Math.ceil(left / 1000)}s</span>}
      </div>

      {game.status === "invited" && (
        <Card className="flex items-center gap-2">
          {game.createdBy === uid ? (
            <p className="flex-1 text-sm text-muted">Waiting for {nameOf(game.players.second)} to accept…</p>
          ) : (
            <>
              <p className="min-w-0 flex-1 text-sm">{nameOf(game.createdBy)} wants to draw with you.</p>
              <Button variant="ghost" onClick={() => void declinePictionary(game.id).then(() => router.push("/play"))} className="px-3 py-2 text-sm">
                Decline
              </Button>
              <Button onClick={() => void acceptPictionary(game.id)} className="px-4 py-2 text-sm">
                Accept
              </Button>
            </>
          )}
        </Card>
      )}

      {game.status === "active" && !game.word && (
        <Card className="flex flex-col items-center gap-2 text-center">
          {drawer ? (
            <>
              <p className="text-sm font-bold">Pick a word to draw</p>
              <div className="flex flex-wrap justify-center gap-2">
                {options.map((w) => (
                  <Button key={w} onClick={() => void chooseWord(game.id, w)} className="px-4 py-2 text-sm">
                    {w}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">{nameOf(game.drawerUid)} is picking a word…</p>
          )}
        </Card>
      )}

      {game.status === "active" && game.word && (
        <>
          {drawer && <p className="text-center text-sm">Draw: <strong>{game.word}</strong></p>}
          <SharedCanvas base={`pictionary/${game.id}`} canDraw={drawer && !game.roundOver} tool={tool} color={color} width={width} page={pictRoute(game.id)} />
          {drawer && !game.roundOver && (
            <div className="card flex items-center gap-1 rounded-[20px] p-2">
              <ToolBtn active={tool === "pen"} onClick={() => setTool("pen")} label="Pen"><Pen size={18} /></ToolBtn>
              <ToolBtn active={tool === "eraser"} onClick={() => setTool("eraser")} label="Eraser"><Eraser size={18} /></ToolBtn>
              {CANVAS_WIDTHS.map((w) => (
                <button key={w} type="button" onClick={() => setWidth(w)} aria-label={`Width ${w}`} aria-pressed={width === w} className={cn("tap grid size-10 place-items-center rounded-full", width === w && "bg-accent-soft")}>
                  <span className="rounded-full bg-text" style={{ width: w + 4, height: w + 4 }} />
                </button>
              ))}
              <span className="flex-1" />
              {CANVAS_COLORS.slice(0, 5).map((c) => (
                <button key={c} type="button" onClick={() => { setColor(c); setTool("pen"); }} aria-label={c} className={cn("tap grid place-items-center rounded-full", color === c && "ring-2 ring-text ring-offset-1")}>
                  <span className="block size-6 rounded-full" style={{ background: c }} />
                </button>
              ))}
            </div>
          )}
          {!drawer && !game.roundOver && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void sendGuess();
              }}
            >
              <Input value={guess} onChange={(e) => setGuess(e.target.value.slice(0, 60))} placeholder="Your guess" aria-label="Guess" autoFocus />
              <Button type="submit" disabled={!guess.trim()} className="shrink-0 px-4">
                Guess
              </Button>
            </form>
          )}
          <div className="card flex max-h-32 flex-col-reverse gap-1 overflow-y-auto rounded-[20px] p-2">
            {[...guesses].reverse().map((g, i) => (
              <p key={i} className={cn("rounded-xl px-2 py-1 text-sm", g.text.toLowerCase() === game.word?.toLowerCase() ? "bg-emerald-400/25 font-bold" : "bg-surface-2")}>
                <span className="text-xs text-muted">{nameOf(g.uid)}: </span>
                {g.text}
              </p>
            ))}
            {guesses.length === 0 && <p className="text-center text-xs text-muted">Guesses show up here.</p>}
          </div>
          {game.roundOver && (
            <Card className="flex items-center gap-3">
              <p className="min-w-0 flex-1 text-sm">
                {game.solvedBy ? `${nameOf(game.solvedBy)} got it — “${game.word}”!` : `Time's up. It was “${game.word}”.`}
              </p>
              <Button onClick={() => void nextRound(game)} className="px-4 py-2 text-sm">
                {game.round >= ROUNDS ? "See results" : "Next round"}
              </Button>
            </Card>
          )}
        </>
      )}

      {game.status === "finished" && (
        <Card className="flex flex-col items-center gap-2 text-center">
          <p className="font-heading text-xl font-semibold">
            {(() => {
              const a = game.players.first;
              const b = game.players.second;
              const sa = game.scores[a] ?? 0;
              const sb = game.scores[b] ?? 0;
              return sa === sb ? "A draw!" : `${nameOf(sa > sb ? a : b)} wins ${Math.max(sa, sb)}–${Math.min(sa, sb)}`;
            })()}
          </p>
          <Button onClick={() => router.push("/play/pictionary")}>Back to lobby</Button>
        </Card>
      )}
      <Confetti burst={burst} />
    </div>
  );
}
