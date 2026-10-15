"use client";

import { onSnapshot } from "firebase/firestore";
import { onValue } from "firebase/database";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { useToast } from "@/components/toast/ToastProvider";
import { useChatMeta } from "@/hooks/useChatMeta";
import { useIncomingPings, type IncomingPing } from "@/hooks/useIncomingPings";
import { useNow } from "@/hooks/useNow";
import { usePair } from "@/hooks/usePair";
import { useVisible } from "@/hooks/useVisible";
import { roomDateKey } from "@/lib/dates";
import { backfillDateKey, dailyRef } from "@/lib/db/daily";
import { gameRoute, resultForRecipient, subscribeOpenGames, type LiveGame } from "@/lib/db/games";
import { mediaLabel } from "@/lib/db/messages";
import { lampPath, rtdbRef } from "@/lib/rtdb";
import { PINGS, type DailyQuestionDoc, type LampNode } from "@/lib/types";

interface LiveEvents {
  /** Latest ping from the friend since this session started; Home shows it full-screen. */
  ping: IncomingPing | null;
  dismissPing: () => void;
  /** Today's daily-question doc (room day), shared with the Home card. */
  today: string;
  daily: DailyQuestionDoc | null;
  /** Invited + active games (one bounded listener for Play and Home). */
  games: LiveGame[];
}

const LiveEventsContext = createContext<LiveEvents | null>(null);

/** Push types the live layer already covers in the foreground; the push controller skips these. */
export const LIVE_PUSH_TYPES = new Set(["message", "scheduled", "ping", "lamp", "daily-answer"]);

/**
 * Turns realtime data we already subscribe to into instant in-app signals:
 * a new message (off the chat screen), a ping (full-screen on Home, a toast
 * elsewhere), a lit lamp (off Home) and the friend's daily answer (off Home).
 */
export function LiveEventsProvider({ children }: { children: React.ReactNode }) {
  const { uid, friend, friendUid, pair } = usePair();
  const { lastMessage } = useChatMeta();
  const { toast } = useToast();
  const pathname = usePathname();
  const visible = useVisible();
  const now = useNow(60_000);
  const today = roomDateKey(pair, now);
  const friendName = friend?.nickname ?? "Your friend";

  const pathRef = useRef(pathname);
  const visibleRef = useRef(visible);
  useEffect(() => {
    pathRef.current = pathname;
    visibleRef.current = visible;
  }, [pathname, visible]);

  /* ── pings ─────────────────────────────────────────────────────────── */
  const incoming = useIncomingPings(uid);
  const [dismissed, setDismissed] = useState<IncomingPing | null>(null);
  const dismissPing = useCallback(() => setDismissed(incoming), [incoming]);
  const lastToastedPing = useRef<number | null>(null);
  useEffect(() => {
    if (!incoming || lastToastedPing.current === incoming.nonce) return;
    lastToastedPing.current = incoming.nonce;
    if (pathRef.current === "/" || !visibleRef.current) return; // Home plays it full-screen
    const p = PINGS[incoming.kind];
    toast({ key: "ping", emoji: p.emoji, title: `${friendName} ${p.sentence}`, url: "/", bounce: true, vibrate: false });
  }, [incoming, friendName, toast]);

  /* ── lamp ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    let first = true;
    let lastUntil = 0;
    const unsub = onValue(rtdbRef(lampPath(uid)), (snap) => {
      const lamp = snap.val() as LampNode | null;
      if (first) {
        first = false;
        lastUntil = lamp?.until ?? 0;
        return;
      }
      if (!lamp?.on || lamp.until <= lastUntil) return;
      lastUntil = lamp.until;
      if (pathRef.current === "/" || !visibleRef.current) return; // the lamp itself glows on Home
      toast({ key: "lamp", emoji: "💡", title: `${friendName} lit your lamp`, body: "Glowing for 10 minutes", url: "/", accent: lamp.color });
    });
    return () => unsub();
  }, [uid, friendName, toast]);

  /* ── messages (reuses the badge/preview listener) ──────────────────── */
  const [mountedAt] = useState(() => Date.now());
  const lastMessageId = useRef<string | null>(null);
  useEffect(() => {
    const m = lastMessage;
    if (!m) return;
    if (lastMessageId.current === null) {
      lastMessageId.current = m.id; // whatever is there at mount is history
      return;
    }
    if (m.id === lastMessageId.current) return;
    lastMessageId.current = m.id;
    if (m.senderId !== friendUid || m.pending || m.deletedForEveryone) return;
    if (m.createdAtMs < mountedAt - 5_000) return;
    if (pathRef.current === "/chat" || !visibleRef.current) return;
    const system = m.type === "system";
    toast({
      key: "message",
      avatar: system ? null : friend,
      emoji: system ? "🥫" : undefined,
      title: system ? "Tincan" : friendName,
      body: mediaLabel(m),
      url: "/chat",
    });
  }, [lastMessage, friendUid, friend, friendName, toast, mountedAt]);

  /* ── daily question (shared with the Home card) ────────────────────── */
  const [daily, setDaily] = useState<DailyQuestionDoc | null>(null);
  const friendAnswered = useRef<boolean | null>(null);
  useEffect(() => {
    friendAnswered.current = null;
    const unsub = onSnapshot(dailyRef(today), (snap) => {
      const data = snap.exists() ? snap.data() : null;
      setDaily(data);
      if (data && !data.dateKey && !snap.metadata.hasPendingWrites) void backfillDateKey(today).catch(() => undefined);
      const answered = Boolean(friendUid && data?.answers?.[friendUid]);
      if (friendAnswered.current === null) {
        friendAnswered.current = answered;
        return;
      }
      if (answered && !friendAnswered.current && pathRef.current !== "/" && visibleRef.current) {
        toast({ key: "daily", emoji: "✍️", title: `${friendName} answered today's question`, body: "Tap to read it", url: "/" });
      }
      friendAnswered.current = answered;
    });
    return () => {
      unsub();
      setDaily(null);
    };
  }, [today, friendUid, friendName, toast]);

  /* ── open games ────────────────────────────────────────────────────── */
  const [games, setGames] = useState<LiveGame[]>([]);
  const seenStatus = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    if (!friendUid) return;
    const unsub = subscribeOpenGames((list) => {
      setGames(list);
      const prev = seenStatus.current;
      const next = new Map(list.map((g) => [g.id, g.status]));
      if (prev) {
        for (const g of list) {
          if (g.status !== "finished" || prev.get(g.id) !== "active") continue;
          if (pathRef.current === gameRoute(g.id) || !visibleRef.current) continue;
          toast({ key: `game:${g.id}`, emoji: "🎲", title: resultForRecipient(g, uid, (id) => (id === uid ? "You" : friendName)), body: "Tap to see the board", url: gameRoute(g.id) });
        }
      }
      seenStatus.current = next;
    });
    return () => {
      unsub();
      seenStatus.current = null;
      setGames([]);
    };
  }, [friendUid, uid, friendName, toast]);

  const activePing = incoming && incoming !== dismissed ? incoming : null;
  const value = useMemo<LiveEvents>(() => ({ ping: activePing, dismissPing, today, daily, games }), [activePing, dismissPing, today, daily, games]);
  return <LiveEventsContext.Provider value={value}>{children}</LiveEventsContext.Provider>;
}

export function useLiveEvents(): LiveEvents {
  const ctx = useContext(LiveEventsContext);
  if (!ctx) throw new Error("useLiveEvents must be used inside <LiveEventsProvider>");
  return ctx;
}
