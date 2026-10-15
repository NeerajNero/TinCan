import type { User } from "firebase/auth";
import { arrayUnion, runTransaction, serverTimestamp, updateDoc } from "firebase/firestore";

import { pairRef, userRef } from "@/lib/db/refs";
import { getDb } from "@/lib/firebase/client";
import { defaultNotifPrefs, type CityPick, type NextMeetup, type PairDoc } from "@/lib/types";

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
