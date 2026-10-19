"use client";

import { useEffect, useState } from "react";

import { onValue } from "@/lib/firebase/rt";
import { rtdbRef } from "@/lib/rtdb";

interface RtdbValue<T> {
  value: T | null;
  /** False until the first snapshot arrives. */
  loaded: boolean;
}

/**
 * Subscribe to one RTDB path while mounted; detaches on unmount or path change
 * so the free-tier connection budget stays lean. Pass null to subscribe to nothing.
 */
export function useRtdbValue<T>(path: string | null): RtdbValue<T> {
  const [state, setState] = useState<RtdbValue<T>>({ value: null, loaded: false });

  useEffect(() => {
    if (!path) return;
    const unsubscribe = onValue(
      rtdbRef(path),
      (snap) => setState({ value: (snap.val() as T | null) ?? null, loaded: true }),
      () => setState({ value: null, loaded: true }),
    );
    return () => {
      unsubscribe();
      setState({ value: null, loaded: false });
    };
  }, [path]);

  return state;
}
