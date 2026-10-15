"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useLiveEvents } from "@/components/live/LiveEventsProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { usePair } from "@/hooks/usePair";
import { cn } from "@/lib/cn";
import { onSnapshot } from "firebase/firestore";

import { acceptGame, declineGame, gameRoute, inviteGame, isLive, loadRecentResults, recordFor, rematch, uidOf, type GameResultDoc } from "@/lib/db/games";
import { quizzesFrom } from "@/lib/db/quizzes";
import { wordleRef } from "@/lib/db/wordle";
import { DECK_KINDS, DECK_META } from "@/lib/decks";
import { roomDateKey } from "@/lib/dates";
import { GAME_META, GAME_TYPES, type GameType } from "@/lib/games";

export function PlayScreen() {
  const { uid, me, friend, friendUid, pair } = usePair();
  const { games } = useLiveEvents();
  const router = useRouter();
  const [busy, setBusy] = useState<GameType | null>(null);
  const today = roomDateKey(pair);
  const [wordMine, setWordMine] = useState<{ done: boolean; solved: boolean } | null>(null);
  const [wordTheirs, setWordTheirs] = useState<{ done: boolean } | null>(null);
  const [newQuizzes, setNewQuizzes] = useState(0);

  // Bounded extras: today's two wordle docs + the friend's published quizzes (≤5), filtered to untaken.
  useEffect(() => {
    const a = onSnapshot(wordleRef(today, uid), (snap) => setWordMine(snap.exists() ? snap.data() : null));
    const b = friendUid ? onSnapshot(wordleRef(today, friendUid), (snap) => setWordTheirs(snap.exists() ? snap.data() : null)) : () => undefined;
    const c = friendUid ? onSnapshot(quizzesFrom(friendUid), (snap) => setNewQuizzes(snap.docs.filter((d) => !d.data().takenBy?.[uid]).length)) : () => undefined;
    return () => {
      a();
      b();
      c();
    };
  }, [today, uid, friendUid]);
  const nameOf = (id: string) => (id === uid ? me.nickname : (friend?.nickname ?? "Friend"));

  const openByType = (type: GameType) => games.find((g) => g.type === type && isLive(g));

  async function tapGame(type: GameType) {
    const existing = openByType(type);
    if (existing) {
      router.push(gameRoute(existing.id));
      return;
    }
    if (!friendUid || busy) return;
    setBusy(type);
    try {
      const id = await inviteGame(type, uid, friendUid);
      router.push(gameRoute(id));
    } finally {
      setBusy(null);
    }
  }

  const invitesForMe = games.filter((g) => g.status === "invited" && g.createdBy !== uid);
  const active = games.filter((g) => g.status === "active" || (g.status === "invited" && g.createdBy === uid));
  const finished = games.filter((g) => g.status === "finished").sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0));

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3 px-1">
        <span className="text-4xl" aria-hidden>
          🎲
        </span>
        <h1 className="text-3xl font-semibold">Play</h1>
      </header>

      <div className="grid grid-cols-2 gap-3">
        {GAME_TYPES.map((type) => {
          const open = openByType(type);
          const meta = GAME_META[type];
          const mine = open && open.status === "active" && uidOf(open, open.turn) === uid;
          return (
            <button key={type} type="button" onClick={() => void tapGame(type)} disabled={!friendUid || busy !== null} className="card tap flex flex-col items-start gap-1.5 rounded-[24px] p-4 text-left disabled:opacity-60">
              <span className="text-3xl" aria-hidden>
                {meta.emoji}
              </span>
              <span className="font-heading text-lg font-semibold leading-tight">{meta.name}</span>
              <span className={cn("text-xs", open ? "font-bold text-[var(--accent)]" : "text-muted")}>
                {busy === type ? "Inviting…" : open ? (open.status === "invited" ? (open.createdBy === uid ? "Invite sent" : "Invited you!") : mine ? "Your turn" : "Their turn") : meta.blurb}
              </span>
            </button>
          );
        })}
      </div>
      {!friendUid && <p className="px-2 text-center text-xs text-muted">Games unlock once your friend joins.</p>}

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-muted">Quick play</h2>
        <div className="grid grid-cols-2 gap-3">
          <Tile href="/play/word" emoji="🟩" title="Daily word" badge={wordMine?.done ? (wordMine.solved ? "Today's word ✓" : "Done for today") : wordTheirs?.done ? "They've played" : "Same word for both"} hot={!wordMine?.done && Boolean(wordTheirs?.done)} />
          <Tile href="/play/trivia" emoji="🧠" title="Trivia duel" badge="10 questions, 15 s each" />
          <Tile href="/play/quiz" emoji="🪞" title="Know-me quiz" badge={newQuizzes > 0 ? `New quiz${newQuizzes > 1 ? ` ×${newQuizzes}` : ""}` : "Write or take one"} hot={newQuizzes > 0} />
          <Tile href="/play/twenty" emoji="🔍" title="20 Questions" badge="Yes, no, sort of" />
          <Tile href="/play/wheel" emoji="🎡" title="Hangout wheel" badge="Spin for an idea" />
          {DECK_KINDS.map((k) => (
            <Tile key={k} href={`/play/deck/${k}`} emoji={DECK_META[k].emoji} title={DECK_META[k].name} badge={DECK_META[k].blurb} />
          ))}
        </div>
      </section>

      {(invitesForMe.length > 0 || active.length > 0) && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-muted">Active games</h2>
          {invitesForMe.map((g) => (
            <Card key={g.id} className="flex items-center gap-3 px-4 py-3">
              <span className="text-2xl" aria-hidden>
                {GAME_META[g.type].emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{nameOf(g.createdBy)} invited you</span>
                <span className="block text-xs text-muted">{GAME_META[g.type].name}</span>
              </span>
              <Button variant="ghost" onClick={() => void declineGame(g.id)} className="px-3 py-2 text-sm">
                Decline
              </Button>
              <Button onClick={() => void acceptGame(g.id).then(() => router.push(gameRoute(g.id)))} className="px-4 py-2 text-sm">
                Accept
              </Button>
            </Card>
          ))}
          {active.map((g) => {
            const mine = g.status === "active" && uidOf(g, g.turn) === uid;
            return (
              <Link key={g.id} href={gameRoute(g.id)} className="card tap flex items-center gap-3 rounded-[20px] px-4 py-3">
                <span className="text-2xl" aria-hidden>
                  {GAME_META[g.type].emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{GAME_META[g.type].name}</span>
                  <span className="block text-xs text-muted">{g.moves} moves{g.lastMoveAt ? ` · ${formatDistanceToNowStrict(new Date(g.lastMoveAt), { addSuffix: true })}` : ""}</span>
                </span>
                <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", g.status === "invited" ? "bg-surface-2 text-muted" : mine ? "bg-[var(--accent)] text-white" : "bg-accent-soft")}>
                  {g.status === "invited" ? "Invited" : mine ? "Your turn" : "Their turn"}
                </span>
              </Link>
            );
          })}
        </section>
      )}

      {finished.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-muted">Just finished</h2>
          {finished.map((g) => {
            const won = g.winnerId === uid;
            return (
              <Card key={g.id} className="flex items-center gap-3 px-4 py-3">
                <Link href={gameRoute(g.id)} className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="text-2xl" aria-hidden>
                    {GAME_META[g.type].emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{g.winnerId ? (won ? "You won 🎉" : `${nameOf(g.winnerId)} won`) : g.endReason === "abandoned" ? "Abandoned" : "Draw"}</span>
                    <span className="block text-xs text-muted">
                      {GAME_META[g.type].name}
                      {g.endReason === "resign" && (won ? " · they resigned" : " · you resigned")}
                      {g.finishedAt && ` · ${formatDistanceToNowStrict(new Date(g.finishedAt), { addSuffix: true })}`}
                    </span>
                  </span>
                </Link>
                <Button onClick={() => void rematch(g).then((id) => router.push(gameRoute(id)))} disabled={Boolean(openByType(g.type))} className="px-4 py-2 text-sm">
                  Rematch
                </Button>
              </Card>
            );
          })}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-muted">Record</h2>
        <Card className="grid grid-cols-4 gap-2 p-3">
          {GAME_TYPES.map((type) => {
            const r = recordFor(pair, type, uid, friendUid);
            return (
              <div key={type} className="flex flex-col items-center gap-0.5 text-center">
                <span className="text-xl" aria-hidden>
                  {GAME_META[type].emoji}
                </span>
                <span className="font-heading text-lg font-semibold tabular-nums">
                  {r.mine}–{r.theirs}
                </span>
                <span className="text-[10px] text-muted">{r.draws ? `${r.draws} draw${r.draws === 1 ? "" : "s"}` : "you–them"}</span>
              </div>
            );
          })}
        </Card>
        <RecentGames nameOf={nameOf} />
      </section>
    </div>
  );
}

function RecentGames({ nameOf }: { nameOf: (uid: string) => string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Array<GameResultDoc & { id: string }> | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && rows === null) setRows(await loadRecentResults().catch(() => []));
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={() => void toggle()} aria-expanded={open} className="tap flex items-center gap-2 px-2 text-sm font-bold text-muted">
        <ChevronDown size={16} className={cn("transition-transform", open && "rotate-180")} />
        Recent games
      </button>
      {open && rows === null && <p className="px-2 text-xs text-muted">Loading…</p>}
      {open && rows?.length === 0 && <p className="px-2 text-xs text-muted">No finished games yet.</p>}
      {open &&
        rows?.map((r) => (
          <div key={r.id} className="card flex items-center gap-3 rounded-[20px] px-4 py-2.5">
            <span className="text-xl" aria-hidden>
              {GAME_META[r.game].emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{r.winnerId ? `${nameOf(r.winnerId)} won` : r.endReason === "abandoned" ? "Abandoned" : "Draw"}</span>
              <span className="block text-xs text-muted">
                {GAME_META[r.game].name} · {r.moves} moves{r.endReason === "resign" && " · resignation"}
                {r.endedAt && ` · ${formatDistanceToNowStrict(r.endedAt.toDate(), { addSuffix: true })}`}
              </span>
            </span>
          </div>
        ))}
    </div>
  );
}

function Tile({ href, emoji, title, badge, hot }: { href: string; emoji: string; title: string; badge: string; hot?: boolean }) {
  return (
    <Link href={href} className="card tap flex flex-col items-start gap-1.5 rounded-[24px] p-4">
      <span className="text-3xl" aria-hidden>
        {emoji}
      </span>
      <span className="font-heading text-lg font-semibold leading-tight">{title}</span>
      <span className={cn("text-xs", hot ? "font-bold text-[var(--accent)]" : "text-muted")}>{badge}</span>
    </Link>
  );
}
