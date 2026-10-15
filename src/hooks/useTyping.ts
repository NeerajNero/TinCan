"use client";

import { remove, serverTimestamp, set } from "firebase/database";
import { useCallback, useEffect, useRef } from "react";

import { useNow } from "@/hooks/useNow";
import { useRtdbValue } from "@/hooks/useRtdbValue";
import { rtdbRef } from "@/lib/rtdb";

const TYPING_TTL_MS = 3000;
const TYPING_THROTTLE_MS = 1500;

export const typingPath = (uid: string) => `typing/${uid}`;

/** True while the friend's typing timestamp is under three seconds old (server clock). */
export function useFriendTyping(friendUid: string | null): boolean {
  const { value: at } = useRtdbValue<number>(friendUid ? typingPath(friendUid) : null);
  const { value: offset } = useRtdbValue<number>(".info/serverTimeOffset");
  const now = useNow(1000);
  if (typeof at !== "number") return false;
  return now.getTime() + (offset ?? 0) - at < TYPING_TTL_MS;
}

/** `ping()` while typing (throttled to one write per 1.5 s); `clear()` on send or blur. */
export function useTypingWriter(uid: string) {
  const lastWrite = useRef(0);
  const wrote = useRef(false);

  const clear = useCallback(() => {
    if (!wrote.current) return;
    wrote.current = false;
    lastWrite.current = 0;
    remove(rtdbRef(typingPath(uid))).catch(() => undefined);
  }, [uid]);

  const ping = useCallback(() => {
    const now = Date.now();
    if (now - lastWrite.current < TYPING_THROTTLE_MS) return;
    lastWrite.current = now;
    wrote.current = true;
    set(rtdbRef(typingPath(uid)), serverTimestamp()).catch(() => undefined);
  }, [uid]);

  // Never leave a stale "typing" behind when the screen unmounts.
  useEffect(() => clear, [clear]);

  return { ping, clear };
}
