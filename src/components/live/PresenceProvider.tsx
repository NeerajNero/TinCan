"use client";

import { onValue } from "firebase/database";
import { createContext, useContext, useEffect, useState } from "react";

import { usePair } from "@/hooks/usePair";
import { presencePath, rtdbRef } from "@/lib/rtdb";
import type { PresenceNode } from "@/lib/types";

const PresenceContext = createContext<PresenceNode | null>(null);

/**
 * The friend's presence node: one RTDB listener for the whole app, in its own
 * context so a heartbeat (every 60 s) re-renders only the components that
 * show presence — never the chat list.
 */
export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { friendUid } = usePair();
  const [presence, setPresence] = useState<PresenceNode | null>(null);
  useEffect(() => {
    if (!friendUid) return;
    const unsub = onValue(rtdbRef(presencePath(friendUid)), (snap) => setPresence((snap.val() as PresenceNode | null) ?? null));
    return () => {
      unsub();
      setPresence(null);
    };
  }, [friendUid]);
  return <PresenceContext.Provider value={presence}>{children}</PresenceContext.Provider>;
}

export function useFriendPresence(): PresenceNode | null {
  return useContext(PresenceContext);
}
