"use client";

import { AnimatePresence, m } from "framer-motion";
import { useEffect, useState } from "react";

import { useRtdbValue } from "@/hooks/useRtdbValue";

const GRACE_MS = 4000;

/**
 * Shows once the realtime connection has been down for 4 s. The grace applies
 * to every disconnect, including launch and resume from background, when the
 * socket always starts "not connected" for a moment. (Before, `stale` stayed
 * true after the first outage, so every later blip flashed the banner at once.)
 */
export function OfflineBanner() {
  const { value: connected, loaded } = useRtdbValue<boolean>(".info/connected");
  const [stale, setStale] = useState(false);
  useEffect(() => {
    if (!loaded) return;
    if (connected) {
      const reset = setTimeout(() => setStale(false), 0);
      return () => clearTimeout(reset);
    }
    const t = setTimeout(() => setStale(true), GRACE_MS);
    return () => clearTimeout(t);
  }, [connected, loaded]);
  const show = loaded && !connected && stale;
  return (
    <AnimatePresence>
      {show && (
        <m.p key="offline" role="status" initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }} className="mx-4 mt-2 rounded-full bg-amber-400/25 px-4 py-2 text-center text-xs font-bold">
          📡 You&apos;re offline — messages and changes will send when you&apos;re back.
        </m.p>
      )}
    </AnimatePresence>
  );
}
