/**
 * Turn timing for More → Diagnostics: a board marks the tap (`start`), the
 * game listener marks the node reflecting it (`observe`, when `moves` grew),
 * and the pair becomes one `TurnTiming`. "local" turns are engine moves the
 * phone commits itself in an RTDB transaction; "server" ones go through
 * `/api/games/*` (Hangman letters, Battleship shots). Pure, so
 * `tests/unit/turnTiming.test.ts` can drive it with a fake clock; the app uses
 * the `turnTimer` singleton.
 */
type TurnKind = "move" | "shot" | "guess";
type TurnMode = "local" | "server";

export interface TurnTiming {
  kind: TurnKind;
  /** Game type, e.g. "chess". */
  game: string;
  mode: TurnMode;
  /** Tap → the board showing the result through the RTDB listener. */
  ms: number;
  /** Wall-clock time of the reflection. */
  at: number;
}

export interface TurnStart {
  gameId: string;
  kind: TurnKind;
  game: string;
  mode: TurnMode;
  /** `moves` on the node when tapped; the turn has landed once it grows. */
  moves: number;
}

/** Turns kept for the diagnostics dump. */
const KEEP = 10;
/** A tap older than this when the node changes was not this turn. */
const STALE_MS = 30_000;

export function createTurnTimer(now: () => number = () => performance.now(), wallClock: () => number = () => Date.now()) {
  let pending: (TurnStart & { start: number }) | null = null;
  const turns: TurnTiming[] = [];
  return {
    /** A board was tapped. A later tap replaces an unfinished one. */
    start(t: TurnStart): void {
      pending = { ...t, start: now() };
    },
    /** The request failed: nothing to time. */
    cancel(gameId: string): void {
      if (pending?.gameId === gameId) pending = null;
    },
    /** The game node arrived with `moves`; returns the recorded turn when it completes the pending tap. */
    observe(gameId: string, moves: number): TurnTiming | null {
      if (!pending || pending.gameId !== gameId || moves <= pending.moves) return null;
      const ms = now() - pending.start;
      const { kind, game, mode } = pending;
      pending = null;
      if (ms < 0 || ms > STALE_MS) return null;
      const t: TurnTiming = { kind, game, mode, ms: Math.round(ms), at: wallClock() };
      turns.push(t);
      if (turns.length > KEEP) turns.splice(0, turns.length - KEEP);
      return t;
    },
    /** Oldest first, at most 10. */
    list: (): readonly TurnTiming[] => turns.slice(),
    last: (): TurnTiming | null => turns[turns.length - 1] ?? null,
  };
}

export const turnTimer = createTurnTimer();

/** "1,240" */
export const formatMs = (ms: number): string => String(Math.round(ms)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** "Last shot" */
export const turnLabel = (t: TurnTiming): string => `Last ${t.kind}`;

/** "1,240 ms (battleship, server)" */
export const formatTurn = (t: TurnTiming): string => `${formatMs(t.ms)} ms (${t.game}, ${t.mode})`;

/** One dump line: "shot battleship server 1240 ms 2026-10-31T11:33:04.000Z". */
export const turnLine = (t: TurnTiming): string => `${t.kind} ${t.game} ${t.mode} ${t.ms} ms ${new Date(t.at).toISOString()}`;
