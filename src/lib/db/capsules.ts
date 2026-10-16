import { getDb } from "@/lib/firebase/client";
import { collection, doc, getDoc, limit, orderBy, query, serverTimestamp, Timestamp, updateDoc, writeBatch, type CollectionReference, type DocumentReference, type Query } from "@/lib/firebase/fs";
import type { CapsuleBody, CapsuleDoc, MediaItem } from "@/lib/types";

export const MIN_LOCK_MS = 60 * 60 * 1000;
const CAPSULE_LIMIT = 50;

const capsulesCol = () => collection(getDb(), "capsules") as CollectionReference<CapsuleDoc>;
const capsuleBodyRef = (id: string) => doc(getDb(), "capsules", id, "private", "body") as DocumentReference<CapsuleBody>;

export function capsulesQuery(): Query<CapsuleDoc> {
  return query(capsulesCol(), orderBy("unlockAt", "desc"), limit(CAPSULE_LIMIT));
}

/** Header + time-gated body in one batch (rules use getAfter for the subdoc). */
export async function createCapsule(authorId: string, title: string, body: string, unlockAt: Date, media: MediaItem[]): Promise<string> {
  const ref = doc(capsulesCol());
  const batch = writeBatch(getDb());
  batch.set(ref, {
    authorId,
    title: title.trim().slice(0, 80),
    unlockAt: Timestamp.fromDate(unlockAt),
    openedAt: null,
    openedBy: null,
    photoCount: media.length,
    createdAt: serverTimestamp(),
  });
  batch.set(capsuleBodyRef(ref.id), { body: body.trim().slice(0, 4000), media });
  await batch.commit();
  return ref.id;
}

export function openCapsule(id: string, uid: string): Promise<void> {
  return updateDoc(doc(getDb(), "capsules", id), { openedAt: serverTimestamp(), openedBy: uid });
}

/** Only succeeds once unlocked (or for the author). */
export async function readCapsuleBody(id: string): Promise<CapsuleBody | null> {
  const snap = await getDoc(capsuleBodyRef(id));
  return snap.exists() ? snap.data() : null;
}

export const isUnlocked = (c: CapsuleDoc, now: Date) => c.unlockAt.toMillis() <= now.getTime();
