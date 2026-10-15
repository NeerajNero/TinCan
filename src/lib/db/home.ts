/**
 * Firestore writes made from Home: check-ins, the streak/plant transaction,
 * mood check-ins and sleep/wake system messages.
 */
import { addDoc, collection, doc, runTransaction, serverTimestamp, setDoc, type DocumentReference } from "firebase/firestore";

import { pairRef } from "@/lib/db/refs";
import { dayUserId, daysBetween, previousDay } from "@/lib/dates";
import { getDb } from "@/lib/firebase/client";
import type { DateKey, MoodDoc, PairDoc, Plant, PresenceStatus, Streak } from "@/lib/types";

export const MAX_PLANT_STAGE = 10;

/** Stage from a streak count: 1 at 0–2 days, 2 at 3–5, … capped at 10. */
export function plantStageFor(streakCount: number): number {
  return Math.min(MAX_PLANT_STAGE, Math.floor(streakCount / 3) + 1);
}

/** Wilted when the last counted day is older than yesterday. */
export function isPlantWilted(streak: Streak | undefined, today: DateKey): boolean {
  if (!streak) return false;
  return daysBetween(streak.lastDateKey, today) > 1;
}

/* ── check-ins ─────────────────────────────────────────────────────────── */

export const checkinRef = (dateKey: DateKey) =>
  doc(getDb(), "checkins", dateKey) as DocumentReference<Record<string, boolean>>;

/** Idempotent: `checkins/{dateKey}.{uid} = true`. */
export function checkIn(dateKey: DateKey, uid: string): Promise<void> {
  return setDoc(checkinRef(dateKey), { [uid]: true }, { merge: true });
}

/**
 * Both checked in today → bump the streak once. Safe to call from both clients:
 * whoever gets there second sees `lastDateKey === today` and does nothing.
 * The plant stage rides along and never decreases.
 */
export async function bumpStreak(today: DateKey): Promise<void> {
  await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(pairRef());
    if (!snap.exists()) return;
    const pair = snap.data() as PairDoc;
    const prev = pair.streak;
    if (prev?.lastDateKey === today) return;

    const count = prev && prev.lastDateKey === previousDay(today) ? prev.count + 1 : 1;
    const streak: Streak = { count, lastDateKey: today };

    const stage = Math.max(pair.plant?.stage ?? 1, plantStageFor(count));
    const plant: Plant =
      stage !== pair.plant?.stage ? { stage, lastGrowthDate: today } : pair.plant ?? { stage, lastGrowthDate: today };

    tx.update(pairRef(), { streak, plant });
  });
}

/* ── moods ─────────────────────────────────────────────────────────────── */

export const moodRef = (dateKey: DateKey, uid: string) =>
  doc(getDb(), "moods", dayUserId(dateKey, uid)) as DocumentReference<MoodDoc>;

export function setMood(dateKey: DateKey, uid: string, emoji: string, note: string): Promise<void> {
  return setDoc(moodRef(dateKey, uid), { emoji, note: note.trim().slice(0, 80), at: serverTimestamp(), dateKey, uid });
}

/* ── system messages ───────────────────────────────────────────────────── */

export async function postSystemMessage(senderId: string, text: string): Promise<void> {
  await addDoc(collection(getDb(), "messages"), {
    senderId,
    type: "system",
    text,
    status: "sent",
    reactions: {},
    deletedFor: [],
    deletedForEveryone: false,
    createdAt: serverTimestamp(),
  });
}

export function sleepWakeText(nickname: string, status: PresenceStatus): string {
  return status === "sleeping" ? `🌙 ${nickname} went to sleep` : `☀️ ${nickname} is up and about`;
}
