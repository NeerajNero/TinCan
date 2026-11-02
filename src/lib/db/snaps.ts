/**
 * Daily snap (phase 27): `snaps/{dateKey}` (the summary both read, merged by
 * each poster) and `snaps/{dateKey}/entries/{uid}` (the photo itself, readable
 * by the other person only once their own entry exists). The streak lives on
 * `pair/main.snap.streak`. Pure rules in `lib/snap.ts`.
 */
import { findMemoryByPublicId, memoriesCol } from "@/lib/db/memories";
import { pairRef } from "@/lib/db/refs";
import { getDb } from "@/lib/firebase/client";
import { addDoc, collection, doc, getDoc, limit, orderBy, query, runTransaction, serverTimestamp, setDoc, startAfter, Timestamp, updateDoc, type CollectionReference, type DocumentReference, type Query, type QueryDocumentSnapshot } from "@/lib/firebase/fs";
import { variantUrl } from "@/lib/mediaUrl";
import { SNAP_CAPTION_MAX, SNAPS_PAGE, snapStreakAfter } from "@/lib/snap";
import type { DateKey, MediaVariants, PairDoc, SnapEntryDoc, SnapSummaryDoc } from "@/lib/types";

const snapsCol = () => collection(getDb(), "snaps") as CollectionReference<SnapSummaryDoc>;
export const snapRef = (dateKey: DateKey) => doc(getDb(), "snaps", dateKey) as DocumentReference<SnapSummaryDoc>;
const snapEntryRef = (dateKey: DateKey, uid: string) => doc(getDb(), "snaps", dateKey, "entries", uid) as DocumentReference<SnapEntryDoc>;

/** Newest day first, 30 per page, ordered by the id-mirroring `dateKey` field (automatic index). */
export function snapsQuery(after: QueryDocumentSnapshot<SnapSummaryDoc> | null): Query<SnapSummaryDoc> {
  return after
    ? query(snapsCol(), orderBy("dateKey", "desc"), startAfter(after), limit(SNAPS_PAGE))
    : query(snapsCol(), orderBy("dateKey", "desc"), limit(SNAPS_PAGE));
}

export interface SnapMedia {
  url: string;
  publicId: string;
  variants?: MediaVariants;
  w: number;
  h: number;
}

/** Write my entry, then merge my keys into the day's summary. */
export async function postSnap(uid: string, dateKey: DateKey, media: SnapMedia, caption: string, timing: { onTime: boolean; later: boolean }): Promise<SnapEntryDoc> {
  const entry: SnapEntryDoc = {
    url: media.url,
    publicId: media.publicId,
    ...(media.variants ? { variants: media.variants } : {}),
    w: media.w,
    h: media.h,
    caption: caption.trim().slice(0, SNAP_CAPTION_MAX),
    at: serverTimestamp() as unknown as Timestamp,
    onTime: timing.onTime,
    later: timing.later,
    savedToMemories: false,
  };
  await setDoc(snapEntryRef(dateKey, uid), entry);
  const thumb = variantUrl(media, "w320");
  await setDoc(
    snapRef(dateKey),
    {
      dateKey,
      posted: { [uid]: true },
      ...(thumb ? { thumbs: { [uid]: thumb } } : {}),
      ...(timing.later ? { later: { [uid]: true } } : {}),
    },
    { merge: true },
  );
  return { ...entry, at: Timestamp.now() };
}

/** One read per entry, only the ones the rules let this person see. */
export async function loadSnapEntry(dateKey: DateKey, uid: string): Promise<SnapEntryDoc | null> {
  const snap = await getDoc(snapEntryRef(dateKey, uid));
  return snap.exists() ? snap.data({ serverTimestamps: "estimate" }) : null;
}

/**
 * Both posted today → bump `pair.snap.streak` once. Safe from both clients:
 * the second one finds `lastDateKey === today` and writes nothing.
 */
export async function bumpSnapStreak(today: DateKey, summary: Pick<SnapSummaryDoc, "posted">): Promise<void> {
  await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(pairRef());
    if (!snap.exists()) return;
    const pair = snap.data() as PairDoc;
    const next = snapStreakAfter(pair.snap?.streak, today, summary, pair.uids);
    if (next) tx.update(pairRef(), { "snap.streak": next });
  });
}

/**
 * Copy a snap into the photo timeline (the asset is shared, never re-uploaded)
 * and mark the entry so the 60-day sweep keeps it. Either person may save
 * either snap; the memory's uploader is whoever saved it.
 */
export async function saveSnapToMemories(uid: string, dateKey: DateKey, entryUid: string, entry: SnapEntryDoc): Promise<void> {
  const existing = await findMemoryByPublicId(entry.publicId);
  if (!existing) {
    await addDoc(memoriesCol(), {
      uploaderId: uid,
      url: entry.url,
      publicId: entry.publicId,
      ...(entry.variants ? { variants: entry.variants } : {}),
      w: entry.w,
      h: entry.h,
      caption: entry.caption,
      takenAt: entry.at ?? Timestamp.now(),
      placeId: null,
      sharedAsset: true,
      createdAt: serverTimestamp(),
    });
  }
  if (!entry.savedToMemories) await updateDoc(snapEntryRef(dateKey, entryUid), { savedToMemories: true });
}
