import { addDoc, collection, deleteDoc, doc, limit, query, serverTimestamp, updateDoc, type CollectionReference, type Query } from "firebase/firestore";

import { getDb } from "@/lib/firebase/client";
import type { PlaceDoc, PlaceKind } from "@/lib/types";

export const placesCol = () => collection(getDb(), "places") as CollectionReference<PlaceDoc>;
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

export function deletePlace(id: string): Promise<void> {
  return deleteDoc(doc(getDb(), "places", id));
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
