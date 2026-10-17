/**
 * Firestore access for the single chat thread. Queries are always bounded.
 */
import { systemLine } from "@/lib/chat/systemKinds";
import { getDb } from "@/lib/firebase/client";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteField,
  doc,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type CollectionReference,
  type DocumentReference,
  type Query,
  type QueryDocumentSnapshot,
} from "@/lib/firebase/fs";
import type { Message, MessageDoc, MessageMedia, MessageType, ReplyTo } from "@/lib/types";

export const PAGE_SIZE = 50;
export const MAX_TEXT = 2000;
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_BATCH = 50;

export const messagesCol = () => collection(getDb(), "messages") as CollectionReference<MessageDoc>;
const messageRef = (id: string) => doc(getDb(), "messages", id) as DocumentReference<MessageDoc>;

/* ── queries ───────────────────────────────────────────────────────────── */

export function latestQuery(): Query<MessageDoc> {
  return query(messagesCol(), orderBy("createdAt", "desc"), limit(PAGE_SIZE));
}

export function olderQuery(before: Timestamp): Query<MessageDoc> {
  return query(messagesCol(), orderBy("createdAt", "desc"), startAfter(before), limit(PAGE_SIZE));
}

export function lastMessageQuery(): Query<MessageDoc> {
  return query(messagesCol(), orderBy("createdAt", "desc"), limit(1));
}

/** Incoming messages I haven't read, capped at 99 for the badge. */
export function unreadQuery(friendUid: string): Query<MessageDoc> {
  return query(messagesCol(), where("senderId", "==", friendUid), where("readAt", "==", null), limit(99));
}

/* ── mapping ───────────────────────────────────────────────────────────── */

export function toMessage(snap: QueryDocumentSnapshot<MessageDoc>): Message {
  const data = snap.data({ serverTimestamps: "estimate" });
  return {
    ...data,
    reactions: data.reactions ?? {},
    deletedFor: data.deletedFor ?? [],
    deletedForEveryone: data.deletedForEveryone ?? false,
    id: snap.id,
    pending: snap.metadata.hasPendingWrites,
    createdAtMs: data.createdAt?.toMillis() ?? Date.now(),
  };
}

/* ── writes ────────────────────────────────────────────────────────────── */

export async function sendText(senderId: string, text: string, replyTo: ReplyTo | null): Promise<string> {
  const ref = await addDoc(messagesCol(), {
    senderId,
    type: "text",
    text: text.slice(0, MAX_TEXT),
    replyTo,
    reactions: {},
    status: "sent",
    deliveredAt: null,
    readAt: null,
    deletedFor: [],
    deletedForEveryone: false,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Image, voice, gif or sticker. `text` is the optional caption. */
export async function sendMedia(
  senderId: string,
  type: Exclude<MessageType, "text" | "system">,
  media: MessageMedia,
  text = "",
  replyTo: ReplyTo | null = null,
): Promise<string> {
  const ref = await addDoc(messagesCol(), {
    senderId,
    type,
    text: text.slice(0, MAX_TEXT),
    media,
    replyTo,
    reactions: {},
    status: "sent",
    deliveredAt: null,
    readAt: null,
    deletedFor: [],
    deletedForEveryone: false,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Short label for a non-text message, used in previews, quotes and pushes. */
export function mediaLabel(m: Pick<Message, "type" | "text" | "deletedForEveryone" | "kind" | "meta">): string {
  if (m.deletedForEveryone) return "This message was deleted";
  switch (m.type) {
    case "image":
      return m.text ? `📷 ${m.text}` : "📷 Photo";
    case "voice":
      return "🎤 Voice note";
    case "gif":
      return "GIF";
    case "sticker":
      return "Sticker";
    case "system":
      return systemLine(m);
    default:
      return m.text;
  }
}

/** True when a Cloudinary asset is attached that the server must destroy on delete-for-everyone. */
export function hasCloudinaryAsset(m: Pick<Message, "type" | "media">): boolean {
  return (m.type === "image" || m.type === "voice") && Boolean(m.media?.publicId);
}

export function editText(id: string, text: string): Promise<void> {
  return updateDoc(messageRef(id), { text: text.slice(0, MAX_TEXT), editedAt: serverTimestamp() });
}

export function canEdit(message: Message, uid: string, now = Date.now()): boolean {
  return (
    message.senderId === uid &&
    message.type === "text" &&
    !message.deletedForEveryone &&
    !message.pending &&
    now - message.createdAtMs < EDIT_WINDOW_MS
  );
}

export function deleteForMe(id: string, uid: string): Promise<void> {
  return updateDoc(messageRef(id), { deletedFor: arrayUnion(uid) });
}

/** Text-only soft delete. Media messages go through DELETE /api/media instead. */
export function deleteForEveryone(id: string): Promise<void> {
  return updateDoc(messageRef(id), { deletedForEveryone: true, text: "", media: null });
}

/** Set my reaction, or clear it when it's already the same emoji. */
export function toggleReaction(message: Message, uid: string, emoji: string): Promise<void> {
  const current = message.reactions[uid];
  return updateDoc(messageRef(message.id), {
    [`reactions.${uid}`]: current === emoji ? deleteField() : emoji,
  });
}

export function replyPreview(message: Message): ReplyTo {
  const preview = mediaLabel(message).slice(0, 120);
  return { id: message.id, preview, senderId: message.senderId, type: message.type };
}

/* ── receipts (recipient only; batches of ≤50) ─────────────────────────── */

async function inBatches(ids: string[], apply: (id: string, batch: ReturnType<typeof writeBatch>) => void) {
  for (let i = 0; i < ids.length; i += MAX_BATCH) {
    const batch = writeBatch(getDb());
    for (const id of ids.slice(i, i + MAX_BATCH)) apply(id, batch);
    await batch.commit();
  }
}

export function markDelivered(ids: string[]): Promise<void> {
  return inBatches(ids, (id, batch) =>
    batch.update(messageRef(id), { deliveredAt: serverTimestamp(), status: "delivered" }),
  );
}

export function markRead(messages: Message[]): Promise<void> {
  return inBatches(
    messages.map((m) => m.id),
    (id, batch) => {
      const m = messages.find((x) => x.id === id);
      batch.update(messageRef(id), {
        readAt: serverTimestamp(),
        status: "read",
        ...(m && !m.deliveredAt ? { deliveredAt: serverTimestamp() } : {}),
      });
    },
  );
}
