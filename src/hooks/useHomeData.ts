"use client";

import { onSnapshot } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";

import { useNow } from "@/hooks/useNow";
import { usePair } from "@/hooks/usePair";
import { bumpStreak, checkIn, checkinRef, moodRef } from "@/lib/db/home";
import { dateKeyIn, roomDateKey } from "@/lib/dates";
import type { MoodDoc } from "@/lib/types";

export interface HomeData {
  /** Today on the room calendar. */
  today: string;
  /** Today on my own calendar (for my mood). */
  myToday: string;
  checkins: Record<string, boolean>;
  myMood: MoodDoc | null;
  friendMood: MoodDoc | null;
}

/**
 * Home's only Firestore listeners beyond the pair provider: today's check-ins
 * doc and today's two mood docs. Also writes my check-in on open and bumps the
 * streak once both are in. Date keys roll over at midnight automatically.
 */
export function useHomeData(): HomeData {
  const { uid, me, friend, friendUid, pair } = usePair();
  const now = useNow(60_000);
  const today = roomDateKey(pair, now);
  const myToday = dateKeyIn(me.tz, now);
  const friendToday = friend ? dateKeyIn(friend.tz, now) : null;

  const [checkins, setCheckins] = useState<Record<string, boolean>>({});
  const [myMood, setMyMood] = useState<MoodDoc | null>(null);
  const [friendMood, setFriendMood] = useState<MoodDoc | null>(null);

  // Check in, then watch today's doc.
  useEffect(() => {
    checkIn(today, uid).catch(() => undefined);
    const unsub = onSnapshot(checkinRef(today), (snap) => setCheckins(snap.data() ?? {}));
    return () => {
      unsub();
      setCheckins({});
    };
  }, [today, uid]);

  // Streak: both in today and not yet counted → one transaction per day per client.
  const bumpedFor = useRef<string | null>(null);
  const bothIn = Boolean(friendUid && checkins[uid] && checkins[friendUid]);
  const lastCounted = pair.streak?.lastDateKey ?? null;
  useEffect(() => {
    if (!bothIn || lastCounted === today || bumpedFor.current === today) return;
    bumpedFor.current = today;
    bumpStreak(today).catch(() => {
      bumpedFor.current = null;
    });
  }, [bothIn, lastCounted, today]);

  // My mood for my own "today".
  useEffect(() => {
    const unsub = onSnapshot(moodRef(myToday, uid), (snap) => setMyMood(snap.exists() ? snap.data() : null));
    return () => {
      unsub();
      setMyMood(null);
    };
  }, [myToday, uid]);

  // Friend's mood for *their* "today".
  useEffect(() => {
    if (!friendUid || !friendToday) return;
    const unsub = onSnapshot(moodRef(friendToday, friendUid), (snap) =>
      setFriendMood(snap.exists() ? snap.data() : null),
    );
    return () => {
      unsub();
      setFriendMood(null);
    };
  }, [friendToday, friendUid]);

  return { today, myToday, checkins, myMood, friendMood };
}
