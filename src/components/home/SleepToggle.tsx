"use client";

import { m } from "framer-motion";
import { useState } from "react";

import { usePair } from "@/hooks/usePair";
import { setMyStatus, useMyStatus } from "@/hooks/usePresence";
import { cn } from "@/lib/cn";
import { postSystemMessage, sleepWakeText } from "@/lib/db/home";

/** "Good night" / "Good morning": flips my presence status and leaves a note in chat. */
export function SleepToggle() {
  const { uid, me } = usePair();
  const status = useMyStatus();
  const [busy, setBusy] = useState(false);
  const sleeping = status === "sleeping";

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const next = sleeping ? "awake" : "sleeping";
    try {
      await setMyStatus(uid, next);
      await postSystemMessage(uid, sleepWakeText(me.nickname, next));
    } finally {
      setBusy(false);
    }
  }

  return (
    <m.button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={sleeping}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "card tap flex w-full items-center gap-3 rounded-[24px] px-4 py-3 text-left",
        sleeping ? "bg-indigo-500/15" : "",
      )}
    >
      <span className="text-3xl" aria-hidden>
        {sleeping ? "🌙" : "☀️"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-heading text-lg font-semibold">{sleeping ? "Good morning" : "Good night"}</span>
        <span className="block text-xs text-muted">
          {sleeping ? "Tap when you're up — it tells them you're awake." : "Tap when you're off — it tells them you're asleep."}
        </span>
      </span>
    </m.button>
  );
}
