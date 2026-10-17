"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { clearRoomChat, sendRoomMessage, subscribeRoomChat, trimRoomChat } from "@/lib/db/roomChat";
import { cleanRoomText, ROOM_CHAT_KEEP, type ChatRoom, type RoomMessage } from "@/lib/roomChat";
import { swallow } from "@/lib/swallow";

/**
 * The room's side chat: one RTDB listener while the screen is mounted (drawer
 * open or closed, so the unread dot works). After each successful send the
 * sender trims anything beyond the newest 50.
 */
export function useRoomChat(room: ChatRoom, uid: string) {
  const [all, setAll] = useState<RoomMessage[] | null>(null);
  const keys = useRef<string[]>([]);

  useEffect(
    () =>
      subscribeRoomChat(room, (list) => {
        keys.current = list.map((m) => m.id);
        setAll(list);
      }),
    [room],
  );

  const send = useCallback(
    async (raw: string) => {
      const text = cleanRoomText(raw);
      if (!text) return;
      await sendRoomMessage(room, uid, text);
      trimRoomChat(room, keys.current).catch(swallow);
    },
    [room, uid],
  );

  const clear = useCallback(() => clearRoomChat(room).catch(swallow), [room]);

  return { messages: all ? all.slice(-ROOM_CHAT_KEEP) : null, send, clear };
}
