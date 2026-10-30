"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useLiveEvents } from "@/components/live/LiveEventsProvider";
import { useFriendPresence } from "@/components/live/PresenceProvider";
import { CloseGameMenu } from "@/components/play/CloseGameMenu";
import { BigTile, CompactTile, type TileBadge } from "@/components/play/PlayTile";
import { RecentGamesList } from "@/components/play/RecentGamesList";
import { useToast } from "@/components/toast/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { HowToButton } from "@/components/ui/HowTo";
import { Sheet, useStickyValue } from "@/components/ui/Sheet";
import { HOWTO } from "@/content/howto";
import { usePair } from "@/hooks/usePair";
import { useStartInvite } from "@/hooks/useStartInvite";
import { cn } from "@/lib/cn";
import { roomDateKey } from "@/lib/dates";
import { acceptGame, declineGame, gameRoute, inviteGame, isLive, isMyMove, loadRecentResults, recordFor, rematch, type GameResultDoc } from "@/lib/db/games";
import { setPlayFavourite } from "@/lib/db/play";
import { quizzesFrom } from "@/lib/db/quizzes";
import { wordleRef } from "@/lib/db/wordle";
import { onSnapshot } from "@/lib/firebase/fs";
import type { GameOptions, GameType } from "@/lib/games";
import { gameInfo, RECORD_GAMES } from "@/lib/games/catalog";
import { DOTS_SIZES } from "@/lib/games/dots";
import { readPref, writePref } from "@/lib/localPref";
import { entriesIn, pickSurprise, PLAY_SECTIONS, playInfo, type PlayEntry, type PlaySection } from "@/lib/play/catalog";
import { favouritesOf, PLAY_RECENT_SHOWN, recentOf, sectionOpen, sectionPrefKey } from "@/lib/play/usage";

const readSectionPrefs = (): Record<PlaySection, string | null> => ({ board: readPref(sectionPrefKey("board")), quick: readPref(sectionPrefKey("quick")), together: readPref(sectionPrefKey("together")) });

export function PlayScreen() {
  const { uid, me, friend, friendUid, pair } = usePair();
  const { games } = useLiveEvents();
  const friendPresence = useFriendPresence();
  const router = useRouter();
  const startInvite = useStartInvite();
  const { toast } = useToast();
  const [busy, setBusy] = useState<GameType | null>(null);
  const [pickSize, setPickSize] = useState(false);
  const [menuFor, setMenuFor] = useState<PlayEntry | null>(null);
  const menuEntry = useStickyValue(menuFor);
  const [prefs, setPrefs] = useState(readSectionPrefs);
  const today = roomDateKey(pair);
  const [wordMine, setWordMine] = useState<{ done: boolean; solved: boolean } | null>(null);
  const [wordTheirs, setWordTheirs] = useState<{ done: boolean } | null>(null);
  const [newQuizzes, setNewQuizzes] = useState(0);
  const friendName = friend?.nickname ?? "Friend";
  const friendPage = friendPresence?.online ? (friendPresence.page ?? "") : "";

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
  const nameOf = (id: string) => (id === uid ? me.nickname : friendName);

  const openByType = (type: GameType) => games.find((g) => g.type === type && isLive(g));

  async function tapGame(type: GameType) {
    const existing = openByType(type);
    if (existing) {
      router.push(gameRoute(existing.id));
      return;
    }
    if (!friendUid || busy) return;
    if (type === "dots") {
      setPickSize(true);
      return;
    }
    await startGame(type);
  }

  async function startGame(type: GameType, options: GameOptions = {}) {
    if (!friendUid || busy) return;
    setBusy(type);
    try {
      const id = await inviteGame(type, uid, friendUid, options);
      void startInvite(type, gameRoute(id), `a game of ${gameInfo(type).name}`, { roundId: id });
      router.push(gameRoute(id));
    } finally {
      setBusy(null);
    }
  }

  function open(entry: PlayEntry) {
    if (entry.section === "board") void tapGame(entry.id as GameType);
    else router.push(entry.href);
  }

  function surprise() {
    if (!friendUid || busy) return;
    const entry = pickSurprise();
    toast({ key: "surprise", emoji: entry.emoji, title: `${entry.name} it is!`, durationMs: 2500 });
    if (entry.section === "board") {
      const type = entry.id as GameType;
      if (openByType(type)) void tapGame(type);
      else void startGame(type);
    } else router.push(entry.href);
  }

  const recent = recentOf(pair.play)
    .map((r) => playInfo(r.id))
    .filter((e): e is PlayEntry => Boolean(e))
    .slice(0, PLAY_RECENT_SHOWN);
  const favouriteIds = favouritesOf(pair.play);
  const favourites = favouriteIds.map((id) => playInfo(id)).filter((e): e is PlayEntry => Boolean(e));
  const hasRecent = recent.length > 0;

  function toggleSection(section: PlaySection) {
    const next = sectionOpen(prefs[section], hasRecent) ? "0" : "1";
    writePref(sectionPrefKey(section), next);
    setPrefs((p) => ({ ...p, [section]: next }));
  }

  async function togglePin(entry: PlayEntry) {
    const pinned = favouriteIds.includes(entry.id);
    setMenuFor(null);
    // A rejected write is already reported by the Firestore wrapper; the toast is only for the cap.
    const ok = await setPlayFavourite(pair.play, entry.id, !pinned).catch(() => true);
    if (!ok) toast({ key: "fav-full", emoji: "📌", title: "Favourites are full", body: "Unpin one first", durationMs: 3000 });
  }

  function badgeFor(entry: PlayEntry): TileBadge | null {
    if (entry.section === "board") {
      const type = entry.id as GameType;
      if (busy === type) return { text: "Inviting…", short: "…", hot: false };
      const game = openByType(type);
      if (!game) return null;
      if (game.status === "invited") return game.createdBy === uid ? { text: "Invite sent", short: "Sent", hot: false } : { text: "Invited you!", short: "Invited", hot: true };
      return isMyMove(game, uid) ? { text: "Your turn", short: "Your turn", hot: true } : { text: "Their turn", short: "Their turn", hot: false };
    }
    if (entry.id === "word" && wordMine?.done) return { text: wordMine.solved ? "Today's word ✓" : "Done for today", short: "Done ✓", hot: false };
    if (entry.id === "word" && wordTheirs?.done) return { text: "They've played", short: "Their go ✓", hot: true };
    if (entry.id === "quiz" && newQuizzes > 0) return { text: `New quiz${newQuizzes > 1 ? ` ×${newQuizzes}` : ""}`, short: "New quiz", hot: true };
    if (friendPage.startsWith(entry.href)) return { text: `${friendName} is here`, short: "Here", hot: true };
    return null;
  }

  const tileProps = (entry: PlayEntry) => ({
    entry,
    badge: badgeFor(entry),
    pinned: favouriteIds.includes(entry.id),
    disabled: entry.section === "board" ? !friendUid || busy !== null : false,
    onOpen: entry.section === "board" ? () => void tapGame(entry.id as GameType) : undefined,
    onMenu: () => setMenuFor(entry),
  });

  const invitesForMe = games.filter((g) => g.status === "invited" && g.createdBy !== uid);
  const active = games
    .filter((g) => g.status === "active" || (g.status === "invited" && g.createdBy === uid))
    .map((g) => ({ g, rank: g.status === "invited" ? 2 : isMyMove(g, uid) ? 0 : 1 }))
    .sort((a, b) => a.rank - b.rank || (b.g.lastMoveAt ?? 0) - (a.g.lastMoveAt ?? 0))
    .map(({ g }) => g);
  const finished = games.filter((g) => g.status === "finished").sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0));

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3 px-1">
        <span className="text-4xl" aria-hidden>
          🎲
        </span>
        <h1 className="flex-1 text-3xl font-semibold">Play</h1>
        <HowToButton topic="play" />
      </header>

      <div className="flex items-center gap-3 px-1">
        <button type="button" onClick={surprise} disabled={!friendUid || busy !== null} className="tap rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-accent-ink shadow-[0_8px_20px_-10px_var(--accent)] disabled:opacity-60">
          🎲 Surprise us
        </button>
        <span className="text-xs text-muted">{friendUid ? "Picks something at random" : "Games unlock once your friend joins."}</span>
      </div>

      {(invitesForMe.length > 0 || active.length > 0) && (
        <section className="flex flex-col gap-2">
          <SectionTitle>Jump back in</SectionTitle>
          {invitesForMe.map((g) => (
            <Card key={g.id} className="flex items-center gap-3 px-4 py-3">
              <span className="text-2xl" aria-hidden>
                {gameInfo(g.type).emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{nameOf(g.createdBy)} invited you</span>
                <span className="block text-xs text-muted">{gameInfo(g.type).name}</span>
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
            const mine = isMyMove(g, uid);
            return (
              <div key={g.id} className="card flex items-center gap-2 rounded-[20px] px-3 py-3">
                <Link href={gameRoute(g.id)} className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="text-2xl" aria-hidden>
                    {gameInfo(g.type).emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{gameInfo(g.type).name}</span>
                    <span className="block text-xs text-muted">{g.moves} moves{g.lastMoveAt ? ` · ${formatDistanceToNowStrict(new Date(g.lastMoveAt), { addSuffix: true })}` : ""}</span>
                  </span>
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", g.status === "invited" ? "bg-surface-2 text-muted" : mine ? "bg-[var(--accent)] text-white" : "bg-accent-soft")}>
                    {g.status === "invited" ? "Invited" : mine ? "Your turn" : "Their turn"}
                  </span>
                </Link>
                <CloseGameMenu game={g} />
              </div>
            );
          })}
        </section>
      )}

      {recent.length > 0 && (
        <section className="flex flex-col gap-1">
          <SectionTitle>Recent</SectionTitle>
          <TileRow>
            {recent.map((entry) => (
              <CompactTile key={entry.id} {...tileProps(entry)} />
            ))}
          </TileRow>
        </section>
      )}

      {favourites.length > 0 && (
        <section className="flex flex-col gap-1">
          <SectionTitle>Favourites</SectionTitle>
          <TileRow>
            {favourites.map((entry) => (
              <CompactTile key={entry.id} {...tileProps(entry)} />
            ))}
          </TileRow>
        </section>
      )}

      {PLAY_SECTIONS.map(({ id, title }) => {
        const expanded = sectionOpen(prefs[id], hasRecent);
        const entries = entriesIn(id);
        return (
          <section key={id} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <SectionTitle>{title}</SectionTitle>
              <button type="button" onClick={() => toggleSection(id)} aria-expanded={expanded} className="tap rounded-full px-3 py-1.5 text-xs font-bold text-[var(--accent)]">
                {expanded ? "Show less" : "See all"}
              </button>
            </div>
            {expanded ? (
              <div className="grid grid-cols-2 gap-3 pt-1">
                {entries.map((entry) => (
                  <BigTile key={entry.id} {...tileProps(entry)} blurb={HOWTO[entry.id].label} />
                ))}
              </div>
            ) : (
              <TileRow>
                {entries.map((entry) => (
                  <CompactTile key={entry.id} {...tileProps(entry)} />
                ))}
              </TileRow>
            )}
          </section>
        );
      })}

      <Sheet open={pickSize} onClose={() => setPickSize(false)} label="Board size" className="flex flex-col gap-3 px-5">
        <p className="font-heading text-lg font-semibold">How big a board?</p>
        <div className="flex gap-2">
          {DOTS_SIZES.map((size) => (
            <Button
              key={size}
              variant={size === 5 ? "primary" : "soft"}
              onClick={() => {
                setPickSize(false);
                void startGame("dots", { size });
              }}
              className="flex-1 flex-col gap-0 py-3"
            >
              <span>
                {size}×{size} dots
              </span>
              <span className="text-xs font-normal opacity-80">
                {size - 1}×{size - 1} boxes{size === 5 ? " · quick" : " · longer"}
              </span>
            </Button>
          ))}
        </div>
      </Sheet>

      <Sheet open={menuFor !== null} onClose={() => setMenuFor(null)} label={menuEntry ? menuEntry.name : "Tile"} className="flex flex-col gap-2 px-5">
        {menuEntry && (
          <>
            <p className="flex items-center gap-2 font-heading text-lg font-semibold">
              <span aria-hidden>{menuEntry.emoji}</span>
              {menuEntry.name}
            </p>
            <Button
              variant="soft"
              onClick={() => {
                setMenuFor(null);
                open(menuEntry);
              }}
              className="justify-start py-3"
            >
              Open
            </Button>
            <Button variant="soft" onClick={() => void togglePin(menuEntry)} className="justify-start py-3">
              {favouriteIds.includes(menuEntry.id) ? "Unpin" : "📌 Pin to favourites"}
            </Button>
            <p className="px-1 text-xs text-muted">Favourites are shared with {friendName}.</p>
          </>
        )}
      </Sheet>

      {finished.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionTitle>Just finished</SectionTitle>
          {finished.map((g) => {
            const won = g.winnerId === uid;
            return (
              <Card key={g.id} className="flex items-center gap-3 px-4 py-3">
                <Link href={gameRoute(g.id)} className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="text-2xl" aria-hidden>
                    {gameInfo(g.type).emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{g.winnerId ? (won ? "You won 🎉" : `${nameOf(g.winnerId)} won`) : g.endReason === "abandoned" ? "Abandoned" : "Draw"}</span>
                    <span className="block text-xs text-muted">
                      {gameInfo(g.type).name}
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
        <SectionTitle>Record</SectionTitle>
        <Card className="grid grid-cols-5 gap-2 p-3">
          {RECORD_GAMES.map((type) => {
            const r = recordFor(pair, type, uid, friendUid);
            return (
              <div key={type} className="flex flex-col items-center gap-0.5 text-center">
                <span className="text-xl" aria-hidden>
                  {gameInfo(type).emoji}
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

const SectionTitle = ({ children }: { children: React.ReactNode }) => <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-muted">{children}</h2>;

/** A sideways-scrolling row of compact tiles: 3.5 visible, snapping, the page gutters used for bleed. */
const TileRow = ({ children }: { children: React.ReactNode }) => (
  <div className="scroll-x -mx-4 flex snap-x gap-2 px-4 pt-2.5 pb-1">
    {children}
  </div>
);

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
      {open && rows && rows.length > 0 && (
        <ErrorBoundary fallback={<p className="px-2 text-xs text-muted">Couldn&apos;t show recent games.</p>}>
          <RecentGamesList rows={rows} nameOf={nameOf} />
        </ErrorBoundary>
      )}
    </div>
  );
}
