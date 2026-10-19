"use client";

import { useEffect } from "react";

import { useToast } from "@/components/toast/ToastProvider";
import { usePair } from "@/hooks/usePair";
import { invitesPath } from "@/lib/db/invites";
import { get, limitToLast, onChildAdded, query, remove } from "@/lib/firebase/rt";
import { INVITE_EMOJI, INVITE_FRESH_MS, isInviteActivity, isInviteRoute, joinRoute, type InviteNode } from "@/lib/invites";
import { rtdbRef } from "@/lib/rtdb";
import { playSound } from "@/lib/sounds";

/**
 * Watches invites/{me} while the app is open. Each child becomes a toast
 * with Join / Not now and is deleted once shown; anything older than two
 * minutes on open is dropped silently (the chat card still carries it).
 * Mounted once by LiveEventsProvider.
 */
export function useIncomingInvites(uid: string, onJoin: (route: string) => void): void {
  const { friend } = usePair();
  const { toast } = useToast();
  const friendName = friend?.nickname ?? "Your friend";

  useEffect(() => {
    const q = query(rtdbRef(invitesPath(uid)), limitToLast(10));
    const seen = new Set<string>();
    let cancelled = false;
    const valid = (v: Partial<InviteNode> | null): v is InviteNode => Boolean(v && typeof v.at === "number" && v.from && isInviteActivity(v.activity) && typeof v.label === "string" && isInviteRoute(v.route));
    const show = (v: InviteNode) => {
      playSound("ping");
      toast({
        key: `invite:${v.activity}`,
        emoji: INVITE_EMOJI[v.activity],
        title: `${friendName} started ${v.label}`,
        body: "Jump in?",
        durationMs: 15_000,
        actions: [
          { label: "Not now", onPress: () => undefined },
          { label: "Join", primary: true, onPress: () => onJoin(joinRoute(v.route)) },
        ],
      });
    };
    let unsub: (() => void) | null = null;
    void get(q)
      .then((snap) => {
        if (cancelled) return;
        const now = Date.now();
        snap.forEach((c) => {
          seen.add(c.key as string);
          const v = c.val() as Partial<InviteNode> | null;
          if (valid(v) && now - v.at < INVITE_FRESH_MS) show(v);
          void remove(c.ref);
        });
        unsub = onChildAdded(q, (c) => {
          const key = c.key as string;
          if (seen.has(key)) return;
          seen.add(key);
          const v = c.val() as Partial<InviteNode> | null;
          if (valid(v) && Date.now() - v.at < INVITE_FRESH_MS) show(v);
          void remove(c.ref);
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      unsub?.();
    };
    // friendName and onJoin are read when a toast is built; a rename mid-session isn't worth a resubscribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, toast]);
}
