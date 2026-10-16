import { getDb } from "@/lib/firebase/client";
import { addDoc, collection, doc, getDocs, limit, query, serverTimestamp, updateDoc, where, writeBatch, type CollectionReference, type Query } from "@/lib/firebase/fs";
import type { PlaceDoc, PlaceKind } from "@/lib/types";

const placesCol = () => collection(getDb(), "places") as CollectionReference<PlaceDoc>;
export const placesQuery = (): Query<PlaceDoc> => query(placesCol(), limit(200));

export interface PlaceInput {
  name: string;
  lat: number;
  lng: number;
  kind: PlaceKind;
  note: string;
  visitedAt: string | null;
}

export async function addPlace(addedBy: string, input: PlaceInput): Promise<string> {
  const ref = await addDoc(placesCol(), { ...clean(input), addedBy, createdAt: serverTimestamp() });
  return ref.id;
}

export function editPlace(id: string, input: PlaceInput): Promise<void> {
  return updateDoc(doc(getDb(), "places", id), clean(input));
}

/**
 * Delete a place and unlink every photo pinned to it, in one batch so the
 * rules can see the place is gone (memories rule: placeId → null only when the
 * place doesn't exist after the write). A place holds far fewer than 450 photos.
 */
export async function deletePlace(id: string): Promise<void> {
  const db = getDb();
  const photos = await getDocs(query(collection(db, "memories"), where("placeId", "==", id), limit(450)));
  const batch = writeBatch(db);
  batch.delete(doc(db, "places", id));
  for (const photo of photos.docs) batch.update(photo.ref, { placeId: null });
  await batch.commit();
}

function clean(input: PlaceInput) {
  return {
    name: input.name.trim().slice(0, 80),
    lat: input.lat,
    lng: input.lng,
    kind: input.kind,
    note: input.note.trim().slice(0, 300),
    visitedAt: input.visitedAt || null,
  };
}
