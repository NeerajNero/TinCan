/**
 * The one client writer for system lines in the chat. The sender is the
 * signed-in user (the rules require it), so callers never pass a uid.
 */
import { systemMessageData, type SystemKind, type SystemMeta } from "@/lib/chat/systemKinds";
import { messagesCol } from "@/lib/db/messages";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { addDoc, serverTimestamp } from "@/lib/firebase/fs";
import type { MessageDoc } from "@/lib/types";

export async function createSystemMessage(kind: SystemKind, text: string, meta?: SystemMeta): Promise<string | null> {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) return null;
  const data = systemMessageData(uid, kind, text, meta, serverTimestamp());
  const ref = await addDoc(messagesCol(), data as unknown as MessageDoc);
  return ref.id;
}
