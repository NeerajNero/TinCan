"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { useRtdbValue } from "@/hooks/useRtdbValue";

/** Shows once the realtime connection has been down for a few seconds. */
export function OfflineBanner() {
  const { value: connected, loaded } = useRtdbValue<boolean>(".info/connected");
  // "stale" flips after the connection has been down for a while; the banner
  // is derived so a reconnect hides it without another state write.
  const [stale, setStale] = useState(false);
  useEffect(() => {
    if (!loaded || connected) return;
    const t = setTimeout(() => setStale(true), 4000);
    return () => clearTimeout(t);
  }, [connected, loaded]);
  const show = loaded && !connected && stale;
  return (
    <AnimatePresence>
      {show && (
        <motion.p key="offline" role="status" initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }} className="mx-4 mt-2 rounded-full bg-amber-400/25 px-4 py-2 text-center text-xs font-bold">
          📡 You&apos;re offline — messages and changes will send when you&apos;re back.
        </motion.p>
      )}
    </AnimatePresence>
  );
}
