/**
 * Pet animation logic that doesn't need React: which reaction plays next, when
 * a flurry of taps becomes "excited", how many particles may be alive, how a
 * long-press tops happiness up, and which pet changes came from the friend.
 * Stats themselves stay in `lib/pet.ts`.
 */
import type { PetDoc } from "@/lib/types";

export const REACTIONS = ["bounce", "wiggle", "spin", "hop", "wink", "blush", "tilt", "squish", "heartHop", "giggle"] as const;
export type Reaction = (typeof REACTIONS)[number];

/** A random reaction that is never the same as the previous one. */
export function pickReaction(prev: Reaction | null, rand: () => number = Math.random): Reaction {
  const pool = prev ? REACTIONS.filter((r) => r !== prev) : REACTIONS;
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))] ?? "bounce";
}

export const BURST_WINDOW_MS = 2000;
export const BURST_TAPS = 3;
export const EXCITED_MS = 3000;

/** Keeps the taps inside the window and says whether they add up to a burst. */
export function tapBurst(taps: readonly number[], now: number): { taps: number[]; excited: boolean } {
  const kept = [...taps, now].filter((t) => now - t <= BURST_WINDOW_MS);
  return { taps: kept, excited: kept.length >= BURST_TAPS };
}

export const MAX_PARTICLES = 20;

/** Adds particles, dropping the oldest so no more than `max` are ever alive. */
export function capParticles<T>(alive: readonly T[], added: readonly T[], max = MAX_PARTICLES): T[] {
  return [...alive, ...added].slice(-max);
}

/** Happiness points gained per second of petting: a full bar in five seconds, like one Play. */
export const PET_POINTS_PER_SEC = 20;

/** Happiness after holding for `heldMs`, starting from `start`. Never above 100 (one Play's worth). */
export const heldHappiness = (start: number, heldMs: number) => Math.min(100, Math.max(start, start + (Math.max(0, heldMs) / 1000) * PET_POINTS_PER_SEC));

/** A random delay in [min, max]. */
export const between = (min: number, max: number, rand: () => number = Math.random) => min + rand() * (max - min);

export type PetEvent = "feed" | "play" | "sleep" | "wake";

/**
 * What changed between two pet snapshots, as the friend's actions: changes
 * whose values this device wrote itself (`isMine`) are skipped.
 */
export function petEvents(prev: PetDoc, next: PetDoc, isMine: (key: string) => boolean): PetEvent[] {
  const out: PetEvent[] = [];
  if (next.hungerAt > prev.hungerAt && !isMine(writeKey("hungerAt", next.hungerAt))) out.push("feed");
  if (next.happyAt > prev.happyAt && !isMine(writeKey("happyAt", next.happyAt))) out.push("play");
  if (next.sleepAt !== prev.sleepAt && !isMine(writeKey("sleepAt", next.sleepAt))) out.push(next.sleepAt > 0 ? "sleep" : "wake");
  return out;
}

export const writeKey = (field: "hungerAt" | "happyAt" | "sleepAt", value: number) => `${field}:${value}`;
