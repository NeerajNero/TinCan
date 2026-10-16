"use client";

import { m } from "framer-motion";
import { X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/Button";
import { usePair } from "@/hooks/usePair";
import { enablePush, permissionState } from "@/lib/push";

const DISMISS_KEY = "tincan-push-nudge-dismissed";
const noop = () => () => undefined;
const serverPerm = () => "default" as const;

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** One-time nudge on Home while push is off and the browser hasn't been asked yet. */
export function PushNudgeCard() {
  const { uid, me } = usePair();
  const permission = useSyncExternalStore(noop, permissionState, serverPerm);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  if (dismissed || me.notif?.enabled === true || permission !== "default") return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // fine
    }
  }

  async function turnOn() {
    setBusy(true);
    try {
      const result = await enablePush(uid);
      if (!result.ok) setHint(result.reason === "denied" ? "No worries — you can turn it on later in More." : "Couldn't set that up here. Try from More → Notifications.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card relative flex items-center gap-3 px-4 py-3">
      <span className="text-3xl" aria-hidden>
        🔔
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-heading font-semibold">Hear the tin can ring?</p>
        <p className="text-xs text-muted">{hint ?? "Get a buzz when they message, hug or light your lamp."}</p>
      </div>
      <Button onClick={turnOn} disabled={busy} className="shrink-0 px-4 py-2 text-sm">
        {busy ? "…" : "Turn on"}
      </Button>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="tap absolute -top-1 -right-1 grid size-9 place-items-center rounded-full text-muted">
        <X size={14} />
      </button>
    </m.div>
  );
}
