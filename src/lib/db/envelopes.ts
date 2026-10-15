import { collection, doc, getDoc, limit, query, serverTimestamp, updateDoc, where, writeBatch, type CollectionReference, type DocumentReference, type Query } from "firebase/firestore";

import { getDb } from "@/lib/firebase/client";
import type { EnvelopeBody, EnvelopeDoc } from "@/lib/types";

export const ENVELOPE_LIMIT = 50;

export const envelopesCol = () => collection(getDb(), "envelopes") as CollectionReference<EnvelopeDoc>;
export const envelopeBodyRef = (id: string) => doc(getDb(), "envelopes", id, "private", "body") as DocumentReference<EnvelopeBody>;

/** Ones addressed to me. */
export const envelopesForMe = (uid: string): Query<EnvelopeDoc> => query(envelopesCol(), where("forUid", "==", uid), limit(ENVELOPE_LIMIT));
/** Ones I wrote. */
export const envelopesByMe = (uid: string): Query<EnvelopeDoc> => query(envelopesCol(), where("authorId", "==", uid), limit(ENVELOPE_LIMIT));

export async function writeEnvelope(authorId: string, forUid: string, label: string, body: string): Promise<string> {
  const ref = doc(envelopesCol());
  const batch = writeBatch(getDb());
  batch.set(ref, { authorId, forUid, label: label.trim().slice(0, 40), openedAt: null, createdAt: serverTimestamp() });
  batch.set(envelopeBodyRef(ref.id), { body: body.trim().slice(0, 4000) });
  await batch.commit();
  return ref.id;
}

/** One-way: stamps openedAt, then the body becomes readable. */
export async function openEnvelope(id: string): Promise<EnvelopeBody | null> {
  await updateDoc(doc(getDb(), "envelopes", id), { openedAt: serverTimestamp() });
  const snap = await getDoc(envelopeBodyRef(id));
  return snap.exists() ? snap.data() : null;
}

export async function readEnvelopeBody(id: string): Promise<EnvelopeBody | null> {
  const snap = await getDoc(envelopeBodyRef(id));
  return snap.exists() ? snap.data() : null;
}
