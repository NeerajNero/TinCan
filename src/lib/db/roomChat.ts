/** RTDB access for the Watch / Listen room chats (roomchat/{room}). One bounded query per screen. */
import { getRtdb } from "@/lib/firebase/client";
import { limitToLast, onValue, orderByKey, push, query, ref, remove, serverTimestamp, update } from "@/lib/firebase/rt";
import { ROOM_CHAT_WINDOW, trimPatch, type ChatRoom, type RoomMessage } from "@/lib/roomChat";

const roomRef = (room: ChatRoom) => ref(getRtdb(), `roomchat/${room}`);

/** Newest ROOM_CHAT_WINDOW messages, oldest first. */
export function subscribeRoomChat(room: ChatRoom, cb: (messages: RoomMessage[]) => void): () => void {
  return onValue(
    query(roomRef(room), orderByKey(), limitToLast(ROOM_CHAT_WINDOW)),
    (snap) => {
      const list: RoomMessage[] = [];
      snap.forEach((c) => {
        const v = c.val() as Partial<RoomMessage> | null;
        if (v && typeof v.text === "string" && typeof v.uid === "string") list.push({ id: c.key as string, uid: v.uid, text: v.text, at: typeof v.at === "number" ? v.at : Date.now() });
      });
      cb(list);
    },
    () => cb([]),
  );
}

export async function sendRoomMessage(room: ChatRoom, uid: string, text: string): Promise<void> {
  await push(roomRef(room), { uid, text, at: serverTimestamp() });
}

/** Delete everything older than the newest 50 of `keys` in one multi-path update. */
export async function trimRoomChat(room: ChatRoom, keys: readonly string[]): Promise<void> {
  const patch = trimPatch(keys);
  if (patch) await update(roomRef(room), patch);
}

export const clearRoomChat = (room: ChatRoom) => remove(roomRef(room));
