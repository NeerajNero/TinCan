/** Pet maths. Stats are derived from timestamps, never stored. */
import type { PetDoc, PetMood } from "@/lib/types";

export const MIN_PER_POINT = 14.4; // 24 h → 100 points
const SLEEP_MS = 8 * 60 * 60 * 1000;
const HUNGRY_BELOW = 30;
const SAD_BELOW = 30;

export const statFrom = (since: number, now: number) => Math.max(0, Math.min(100, 100 - (now - since) / 60_000 / MIN_PER_POINT));

export function petStats(pet: PetDoc, now = Date.now()) {
  const hunger = statFrom(pet.hungerAt, now);
  const happiness = statFrom(pet.happyAt, now);
  const sleeping = pet.sleepAt > 0 && now - pet.sleepAt < SLEEP_MS;
  const wakesAt = sleeping ? pet.sleepAt + SLEEP_MS : null;
  const mood: PetMood = sleeping ? "sleeping" : hunger < HUNGRY_BELOW ? "hungry" : happiness < SAD_BELOW ? "sad" : "happy";
  return { hunger, happiness, sleeping, wakesAt, mood };
}

/** Level = floor(streak / 7) + 1. */
export const levelFor = (streak: number) => Math.floor(Math.max(0, streak) / 7) + 1;

/** Ms until hunger hits zero. */
export const emptyAt = (pet: PetDoc) => pet.hungerAt + 100 * MIN_PER_POINT * 60_000;

/** The timestamp that makes `statFrom` read `value` at `now` (inverse of `statFrom`). */
export const sinceFor = (value: number, now: number) => now - (100 - Math.max(0, Math.min(100, value))) * MIN_PER_POINT * 60_000;
