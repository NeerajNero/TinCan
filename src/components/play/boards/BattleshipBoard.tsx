"use client";

import { AnimatePresence, m } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { InviteButton } from "@/components/play/InviteButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useRtdbValue } from "@/hooks/useRtdbValue";
import { cn } from "@/lib/cn";
import { fireBattleshipShot, gameRoute, privateGamePath, readyBattleship, type LiveGame } from "@/lib/db/games";
import { BS_SHIPS, BS_SIZE, cellIndex, cellsOf, fleetValid, randomFleet, shipName, shipsFit, type BattleshipState, type Ship } from "@/lib/games/battleship";
import { other, type Player } from "@/lib/games/types";
import { errorMessage } from "@/lib/swallow";

const COLS = Array.from({ length: BS_SIZE }, (_, i) => i);
const LETTERS = "ABCDEFGHIJ";

function parseFleet(raw: unknown): Ship[] | null {
  if (typeof raw !== "string") return null;
  try {
    const f = JSON.parse(raw) as Ship[];
    return Array.isArray(f) ? f : null;
  } catch {
    return null;
  }
}

/**
 * Battleship: place five ships (tap, rotate, drag, random), then take turns
 * firing at the other grid. Only the shared node is rendered for the
 * opponent's side; my own fleet comes from my owner-only subtree.
 */
export function BattleshipBoard({ game, state, me, uid, nameOf }: { game: LiveGame; state: BattleshipState; me: Player | null; uid: string; nameOf: (uid: string) => string }) {
  const active = game.status === "active";
  const friendUid = game.players.first === uid ? game.players.second : game.players.first;
  const friendName = nameOf(friendUid);
  const myReady = me ? state.ready[me] : false;
  const priv = useRtdbValue<{ fleet?: string }>(me && game.status !== "declined" ? privateGamePath(game.id, uid) : null);
  const myFleet = parseFleet(priv.value?.fleet) ?? [];
  const [busyCell, setBusyCell] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sunk announcements: a shot that arrived after mount and sank something shows a banner until dismissed by the timer.
  const last = state.last;
  const lastKey = last ? `${last.by}:${last.cell}` : null;
  const [dismissedKey, setDismissedKey] = useState(lastKey);
  const banner = last && last.result === "sunk" && lastKey !== dismissedKey ? (last.by === me ? `💥 You sank their ${shipName(last.len ?? 0)}!` : `💥 ${friendName} sank your ${shipName(last.len ?? 0)}`) : null;
  useEffect(() => {
    if (!banner) return;
    try {
      navigator.vibrate?.(last?.by === me ? [20, 40, 20] : 60);
    } catch {
      // no haptics
    }
    const t = setTimeout(() => setDismissedKey(lastKey), 2200);
    return () => clearTimeout(t);
  }, [banner, lastKey, last?.by, me]);

  if (!me) return <Card className="py-6 text-center text-muted">Only the two players can see the boards.</Card>;

  if (state.phase === "placing" && !myReady && active) {
    return <FleetPlacer onReady={(fleet) => readyBattleship(game, uid, fleet)} />;
  }

  const myTurn = active && state.phase === "firing" && state.turn === me;
  const theirShots = state.shots[other(me)];
  const myShots = state.shots[me];
  const theirSunk = state.sunk[other(me)];
  const mySunk = state.sunk[me];

  async function fire(cell: number) {
    if (!myTurn || busyCell !== null || myShots[String(cell)]) return;
    setBusyCell(cell);
    setError(null);
    try {
      await fireBattleshipShot(game.id, cell);
    } catch (err) {
      setError(errorMessage(err, "That shot didn't go through"));
    } finally {
      setBusyCell(null);
    }
  }

  return (
    <div className="relative flex flex-col gap-3">
      <AnimatePresence>
        {banner && (
          <m.div key={banner} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0, y: -30 }} className="pointer-events-none absolute inset-x-0 top-24 z-20 flex justify-center" aria-live="assertive">
            <span className="rounded-full bg-surface px-4 py-2 font-heading text-lg font-semibold shadow-lg">{banner}</span>
          </m.div>
        )}
      </AnimatePresence>

      {state.phase === "placing" && (
        <Card className="flex flex-col gap-2">
          <p className="font-heading text-lg font-semibold">Waiting for {friendName} to place ships</p>
          <p className="text-sm text-muted">Your fleet is in. The first shot is {me === "first" ? "yours" : "theirs"} once they&apos;re ready.</p>
          <InviteButton spec={{ activity: "battleship", route: gameRoute(game.id), label: "a game of Battleship", roundId: game.id }} />
        </Card>
      )}

      {state.phase !== "placing" && (
        <section className="flex flex-col gap-1.5">
          <header className="flex items-center justify-between px-1 text-sm font-bold">
            <span>{friendName}&apos;s waters</span>
            <span className="text-xs text-muted">{BS_SHIPS.length - theirSunk.length} of {BS_SHIPS.length} afloat</span>
          </header>
          <Grid
            size="lg"
            label={`${friendName}'s grid`}
            cell={(k) => {
              const shot = myShots[String(k)];
              const sunk = theirSunk.some((s) => s.cells.includes(k));
              const isLast = last?.by === me && last.cell === k;
              return (
                <button key={k} type="button" disabled={!myTurn || Boolean(shot) || busyCell !== null} onClick={() => void fire(k)} aria-label={`${LETTERS[Math.floor(k / BS_SIZE)]}${(k % BS_SIZE) + 1}${shot ? `, ${shot}` : ""}`} className={cn("tap grid aspect-square place-items-center rounded-md text-base", shot === "hit" ? (sunk ? "bg-red-700 text-white" : "bg-red-500 text-white") : shot === "miss" ? "bg-surface-2 text-muted" : "bg-sky-500/15", myTurn && !shot && "hover:bg-sky-500/30", isLast && "ring-2 ring-[var(--accent)]", busyCell === k && "animate-pulse")}>
                  {shot === "hit" ? "✕" : shot === "miss" ? "•" : ""}
                </button>
              );
            }}
          />
          <p className="px-1 text-center text-xs text-muted" aria-live="polite">
            {!active ? "" : myTurn ? "Tap a cell to fire" : `${friendName} is taking aim…`}
          </p>
          {error && <p className="text-center text-xs font-bold text-red-500">{error}</p>}
        </section>
      )}

      <section className="flex flex-col gap-1.5">
        <header className="flex items-center justify-between px-1 text-sm font-bold">
          <span>Your fleet</span>
          <span className="text-xs text-muted">{BS_SHIPS.length - mySunk.length} of {BS_SHIPS.length} afloat</span>
        </header>
        <Grid
          size={state.phase === "placing" ? "lg" : "sm"}
          label="Your grid"
          cell={(k) => {
            const ship = myFleet.some((s) => cellsOf(s).includes(k));
            const shot = theirShots[String(k)];
            const isLast = last?.by === other(me) && last.cell === k;
            return (
              <span key={k} aria-label={`${LETTERS[Math.floor(k / BS_SIZE)]}${(k % BS_SIZE) + 1}${ship ? ", ship" : ""}${shot ? `, ${shot}` : ""}`} className={cn("grid aspect-square place-items-center rounded-[4px] text-[10px]", ship ? (shot === "hit" ? "bg-red-500 text-white" : "bg-slate-500 text-white") : shot === "miss" ? "bg-surface-2 text-muted" : "bg-sky-500/15", isLast && "ring-2 ring-[var(--accent)]")}>
                {shot === "hit" ? "✕" : shot === "miss" ? "•" : ""}
              </span>
            );
          }}
        />
      </section>
    </div>
  );
}

function Grid({ size, label, cell }: { size: "lg" | "sm"; label: string; cell: (k: number) => React.ReactNode }) {
  return (
    <div role="grid" aria-label={label} className={cn("card mx-auto grid w-full grid-cols-10 rounded-[20px]", size === "lg" ? "max-w-[340px] gap-1 p-2" : "max-w-[220px] gap-0.5 p-1.5")}>
      {COLS.flatMap((r) => COLS.map((c) => cell(cellIndex(r, c))))}
    </div>
  );
}

/* ── placement ──────────────────────────────────────────────────────────── */

type Placed = Ship | null;

function FleetPlacer({ onReady }: { onReady: (fleet: Ship[]) => Promise<void> }) {
  const [ships, setShips] = useState<Placed[]>(() => BS_SHIPS.map(() => null));
  const [selected, setSelected] = useState(0);
  const [dir, setDir] = useState<Ship["dir"]>("h");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ index: number; offset: number; moved: boolean } | null>(null);

  const placed = ships.filter((s): s is Ship => s !== null);
  const complete = placed.length === BS_SHIPS.length && fleetValid(placed);
  const occupant = (k: number) => ships.findIndex((s) => s !== null && cellsOf(s).includes(k));
  const fits = (index: number, ship: Ship) => shipsFit([...ships.filter((s, i): s is Ship => s !== null && i !== index), ship]);

  function put(index: number, ship: Ship): boolean {
    if (!fits(index, ship)) return false;
    setShips((list) => list.map((s, i) => (i === index ? ship : s)));
    return true;
  }

  function cellFromPointer(e: React.PointerEvent): number | null {
    const el = gridRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const c = Math.floor(((e.clientX - rect.left) / rect.width) * BS_SIZE);
    const r = Math.floor(((e.clientY - rect.top) / rect.height) * BS_SIZE);
    return r >= 0 && r < BS_SIZE && c >= 0 && c < BS_SIZE ? cellIndex(r, c) : null;
  }

  function onPointerDown(e: React.PointerEvent) {
    const k = cellFromPointer(e);
    if (k === null) return;
    const idx = occupant(k);
    if (idx >= 0) {
      const ship = ships[idx]!;
      setSelected(idx);
      drag.current = { index: idx, offset: cellsOf(ship).indexOf(k), moved: false };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } else {
      drag.current = null;
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const k = cellFromPointer(e);
    if (k === null) return;
    const ship = ships[d.index];
    if (!ship) return;
    const r = Math.floor(k / BS_SIZE) - (ship.dir === "v" ? d.offset : 0);
    const c = (k % BS_SIZE) - (ship.dir === "h" ? d.offset : 0);
    if (r === ship.r && c === ship.c) return;
    d.moved = true;
    put(d.index, { ...ship, r, c });
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    drag.current = null;
    if (d) {
      // A tap on a ship (no drag) only selects it.
      return;
    }
    const k = cellFromPointer(e);
    if (k === null) return;
    const len = BS_SHIPS[selected];
    if (len === undefined) return;
    const current = ships[selected];
    const ship: Ship = { r: Math.floor(k / BS_SIZE), c: k % BS_SIZE, len, dir: current?.dir ?? dir };
    if (!put(selected, ship)) setError("That doesn't fit there");
    else {
      setError(null);
      const nextEmpty = ships.findIndex((s, i) => s === null && i !== selected);
      if (nextEmpty >= 0) setSelected(nextEmpty);
    }
  }

  function rotate() {
    const ship = ships[selected];
    if (!ship) {
      setDir((d) => (d === "h" ? "v" : "h"));
      return;
    }
    if (!put(selected, { ...ship, dir: ship.dir === "h" ? "v" : "h" })) setError("No room to rotate here");
    else setError(null);
  }

  async function ready() {
    if (!complete) return;
    setBusy(true);
    setError(null);
    try {
      await onReady(placed);
    } catch (err) {
      setError(errorMessage(err, "Couldn't save your fleet"));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-col gap-2 py-3">
        <p className="font-heading text-lg font-semibold">Place your ships</p>
        <p className="text-xs text-muted">Pick a ship, tap where its bow goes. Drag a placed ship to move it. Rotate flips the selected one.</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ships">
          {BS_SHIPS.map((len, i) => (
            <button key={i} type="button" onClick={() => setSelected(i)} aria-pressed={selected === i} className={cn("tap flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-bold", selected === i ? "bg-[var(--accent)] text-white" : ships[i] ? "bg-surface-2 text-muted" : "bg-accent-soft")}>
              <span className="flex gap-px" aria-hidden>
                {Array.from({ length: len }, (_, k) => (
                  <span key={k} className="block size-2 rounded-[2px] bg-current" />
                ))}
              </span>
              {shipName(len)}
              {ships[i] && " ✓"}
            </button>
          ))}
        </div>
      </Card>

      <div ref={gridRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => (drag.current = null)} role="grid" aria-label="Your grid" className="card mx-auto grid w-full max-w-[340px] touch-none grid-cols-10 gap-1 rounded-[20px] p-2">
        {COLS.flatMap((r) =>
          COLS.map((c) => {
            const k = cellIndex(r, c);
            const idx = occupant(k);
            return <span key={k} aria-label={`${LETTERS[r]}${c + 1}${idx >= 0 ? `, ${shipName(BS_SHIPS[idx] ?? 0)}` : ""}`} className={cn("grid aspect-square place-items-center rounded-md", idx >= 0 ? (idx === selected ? "bg-[var(--accent)]" : "bg-slate-500") : "bg-sky-500/15")} />;
          }),
        )}
      </div>

      {error && <p className="text-center text-xs font-bold text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button variant="soft" onClick={rotate} className="flex-1 py-2.5 text-sm" disabled={busy}>
          ↻ Rotate{!ships[selected] && ` (${dir === "h" ? "across" : "down"})`}
        </Button>
        <Button variant="soft" onClick={() => { setShips(randomFleet()); setError(null); }} className="flex-1 py-2.5 text-sm" disabled={busy}>
          🎲 Random
        </Button>
        <Button onClick={() => void ready()} disabled={!complete || busy} className="flex-1 py-2.5 text-sm">
          {busy ? "…" : "Ready"}
        </Button>
      </div>
    </div>
  );
}
