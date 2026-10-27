
import type { User } from "firebase/auth";

import { pairRef, userRef } from "@/lib/db/refs";
import { getDb } from "@/lib/firebase/client";
import { arrayUnion, deleteField, runTransaction, serverTimestamp, updateDoc } from "@/lib/firebase/fs";
import { defaultNotifPrefs, type ChatBgPref, type CityPick, type NextMeetup, type PairDoc, type UserDoc } from "@/lib/types";
import { planWallpaperMigration } from "@/lib/wallpaper";


/** Thrown when `pair/main` already belongs to two other accounts. */
export class PairFullError extends Error {
  readonly code = "pair_full";
  constructor() {
    super("This tin can already has two people on it.");
  }
}

export interface OnboardingInput {
  nickname: string;
  place: CityPick;
}

/**
 * First sign-in: creates `users/{uid}` and joins `pair/main` in one transaction.
 * The first person creates the pair and sets the room's time zone; the second is
 * appended. Anyone else gets `PairFullError`.
 */
export async function completeOnboarding(user: User, input: OnboardingInput): Promise<void> {
  const db = getDb();
  const uid = user.uid;

  await runTransaction(db, async (tx) => {
    const pairSnap = await tx.get(pairRef());

    if (!pairSnap.exists()) {
      const fresh: PairDoc = {
        uids: [uid],
        roomTz: input.place.tz,
        friendsSince: null,
        nextMeetup: null,
        createdAt: null,
      };
      tx.set(pairRef(), { ...fresh, createdAt: serverTimestamp() });
    } else {
      const uids = pairSnap.data().uids ?? [];
      if (!uids.includes(uid)) {
        if (uids.length >= 2) throw new PairFullError();
        tx.update(pairRef(), { uids: arrayUnion(uid) });
      }
    }

    tx.set(userRef(uid), {
      name: user.displayName ?? "",
      nickname: input.nickname.trim(),
      email: user.email ?? "",
      photoURL: user.photoURL ?? null,
      tz: input.place.tz,
      city: input.place.city,
      lat: input.place.lat,
      lng: input.place.lng,
      fcmTokens: [],
      notif: defaultNotifPrefs(),
      createdAt: serverTimestamp(),
    });
  });
}

export function setFriendsSince(date: string | null): Promise<void> {
  return updateDoc(pairRef(), { friendsSince: date });
}

export function setNextMeetup(meetup: NextMeetup | null): Promise<void> {
  return updateDoc(pairRef(), { nextMeetup: meetup });
}

export function setRelationship(id: string): Promise<void> {
  return updateDoc(pairRef(), { relationship: id });
}

/* ── shared chat wallpaper ─────────────────────────────────────────────── */

/** Set the wallpaper for both (null = plain) and note who did it. */
export function setPairChatBg(by: string, chatBg: ChatBgPref | null): Promise<void> {
  return updateDoc(pairRef(), { chatBg, chatBgBy: by });
}

/**
 * One-time move of the legacy users/{me}.chatBg onto pair/main: copies it when
 * the pair has no wallpaper yet, then clears the per-user field (the users
 * rules no longer accept it). Nothing to do once the field is gone.
 */
export async function migrateWallpaper(uid: string, me: Pick<UserDoc, "chatBg">, pair: Pick<PairDoc, "chatBg">): Promise<void> {
  const plan = planWallpaperMigration(pair.chatBg, me.chatBg);
  if (plan.copyToPair !== undefined) await updateDoc(pairRef(), { chatBg: plan.copyToPair, chatBgBy: uid });
  if (plan.clearMine) await updateDoc(userRef(uid), { chatBg: deleteField() });
}
