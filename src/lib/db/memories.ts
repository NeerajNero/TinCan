import { getDb } from "@/lib/firebase/client";
import { addDoc, collection, doc, getDocs, limit, orderBy, query, serverTimestamp, startAfter, Timestamp, updateDoc, where, type CollectionReference, type Query, type QueryDocumentSnapshot } from "@/lib/firebase/fs";
import type { MediaItem, MemoryDoc, Message } from "@/lib/types";

export const MEMORIES_PAGE = 40;

export const memoriesCol = () => collection(getDb(), "memories") as CollectionReference<MemoryDoc>;

export function memoriesQuery(after: QueryDocumentSnapshot<MemoryDoc> | null): Query<MemoryDoc> {
  return after
    ? query(memoriesCol(), orderBy("takenAt", "desc"), startAfter(after), limit(MEMORIES_PAGE))
    : query(memoriesCol(), orderBy("takenAt", "desc"), limit(MEMORIES_PAGE));
}

/** Photos pinned to one place (equality only, no index). */
export const memoriesAtPlace = (placeId: string): Query<MemoryDoc> => query(memoriesCol(), where("placeId", "==", placeId), limit(30));

export async function addMemories(uploaderId: string, items: MediaItem[], caption: string, takenAt: Date, placeId: string | null): Promise<void> {
  await Promise.all(
    items.map((m) =>
      addDoc(memoriesCol(), {
        uploaderId,
        url: m.url,
        publicId: m.publicId,
        w: m.w,
        h: m.h,
        caption: caption.trim().slice(0, 300),
        takenAt: Timestamp.fromDate(takenAt),
        placeId,
        createdAt: serverTimestamp(),
      }),
    ),
  );
}

/** The memory that already holds this Cloudinary asset, if any. */
export async function findMemoryByPublicId(publicId: string): Promise<string | null> {
  const snap = await getDocs(query(memoriesCol(), where("publicId", "==", publicId), limit(1)));
  return snap.docs[0]?.id ?? null;
}

/** From the chat viewer: reuse the message's Cloudinary asset, no re-upload. */
export async function saveMessageToMemories(uid: string, message: Message): Promise<string> {
  const media = message.media;
  if (!media?.url || !media.publicId) throw new Error("no_asset");
  const ref = await addDoc(memoriesCol(), {
    uploaderId: uid,
    url: media.url,
    publicId: media.publicId,
    w: media.w ?? 4,
    h: media.h ?? 3,
    caption: message.text.slice(0, 300),
    takenAt: Timestamp.fromMillis(message.createdAtMs),
    placeId: null,
    sharedAsset: true,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export function editMemory(id: string, changes: { caption?: string; takenAt?: Date; placeId?: string | null }): Promise<void> {
  return updateDoc(doc(getDb(), "memories", id), {
    ...(changes.caption !== undefined ? { caption: changes.caption.trim().slice(0, 300) } : {}),
    ...(changes.takenAt ? { takenAt: Timestamp.fromDate(changes.takenAt) } : {}),
    ...(changes.placeId !== undefined ? { placeId: changes.placeId } : {}),
  });
}
