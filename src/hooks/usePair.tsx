"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";
import { PairFullScreen } from "@/components/pair/PairFullScreen";
import { Splash } from "@/components/ui/Splash";
import { useAuth } from "@/hooks/useAuth";
import { pairRef, userRef } from "@/lib/db/refs";
import { onSnapshot, type DocumentSnapshot } from "@/lib/firebase/fs";
import type { PairDoc, UserDoc } from "@/lib/types";

export interface PairContextValue {
  /** My uid. */
  uid: string;
  me: UserDoc;
  /** The other person, or null until they've signed in and onboarded. */
  friend: UserDoc | null;
  friendUid: string | null;
  pair: PairDoc;
  /** True while a dependent document (friend) is still on its first load. */
  loading: boolean;
}

const PairContext = createContext<PairContextValue | null>(null);

/**
 * A snapshot is "settled" once we have either server data or a cached doc that
 * exists. A cached "doesn't exist" is not proof — the doc may just never have
 * been fetched — so we keep waiting for the server before deciding to onboard.
 */
type Slot<T> = { state: "pending" } | { state: "ready"; data: T | null };

function settle<T>(snap: DocumentSnapshot<T>): Slot<T> {
  if (snap.exists()) return { state: "ready", data: snap.data() };
  if (snap.metadata.fromCache) return { state: "pending" };
  return { state: "ready", data: null };
}

/**
 * Mounted once inside the auth gate. Subscribes to `pair/main`, `users/{me}` and
 * `users/{friend}` exactly once for the whole app; every screen reads through
 * `usePair()` instead of attaching its own listeners.
 */
export function PairProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [me, setMe] = useState<Slot<UserDoc>>({ state: "pending" });
  const [pair, setPair] = useState<Slot<PairDoc>>({ state: "pending" });
  const [friend, setFriend] = useState<Slot<UserDoc>>({ state: "pending" });
  const [error, setError] = useState<string | null>(null);

  // users/{me}
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      userRef(uid),
      { includeMetadataChanges: true },
      (snap) => setMe(settle(snap)),
      (err) => setError(err.message),
    );
    return () => {
      unsub();
      setMe({ state: "pending" });
    };
  }, [uid]);

  // pair/main
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      pairRef(),
      { includeMetadataChanges: true },
      (snap) => setPair(settle(snap)),
      (err) => setError(err.message),
    );
    return () => {
      unsub();
      setPair({ state: "pending" });
    };
  }, [uid]);

  const pairData = pair.state === "ready" ? pair.data : null;
  const friendUid = useMemo(() => {
    if (!uid || !pairData) return null;
    return pairData.uids.find((id) => id !== uid) ?? null;
  }, [uid, pairData]);
  const pairFull = Boolean(uid && pairData && pairData.uids.length >= 2 && !pairData.uids.includes(uid));

  // users/{friend} — only once we know who that is.
  useEffect(() => {
    if (!friendUid) return;
    const unsub = onSnapshot(
      userRef(friendUid),
      { includeMetadataChanges: true },
      (snap) => setFriend(settle(snap)),
      (err) => setError(err.message),
    );
    return () => {
      unsub();
      setFriend({ state: "pending" });
    };
  }, [friendUid]);

  const meData = me.state === "ready" ? me.data : null;
  const friendData = friend.state === "ready" ? friend.data : null;
  const friendLoading = Boolean(friendUid) && friend.state === "pending";

  const value = useMemo<PairContextValue | null>(() => {
    if (!uid || !meData || !pairData) return null;
    return { uid, me: meData, friend: friendData, friendUid, pair: pairData, loading: friendLoading };
  }, [uid, meData, pairData, friendData, friendUid, friendLoading]);

  if (!uid) return <Splash />;
  if (error) return <PairFullScreen title="Can't reach the tin can" message={error} />;
  if (pairFull) return <PairFullScreen />;
  if (me.state === "pending" || pair.state === "pending") return <Splash label="Finding your friend…" />;
  if (!value) return <OnboardingScreen />;

  return <PairContext.Provider value={value}>{children}</PairContext.Provider>;
}

export function usePair(): PairContextValue {
  const ctx = useContext(PairContext);
  if (!ctx) throw new Error("usePair must be used inside <PairProvider>");
  return ctx;
}
