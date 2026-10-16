"use client";

import { AnimatePresence, m } from "framer-motion";
import { BellRing, ChevronRight } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { usePair } from "@/hooks/usePair";
import { cn } from "@/lib/cn";
import { userRef } from "@/lib/db/refs";
import { updateDoc } from "@/lib/firebase/fs";
import { notify } from "@/lib/notify";
import { disablePush, enablePush, permissionState, type EnableResult } from "@/lib/push";
import { swallow } from "@/lib/swallow";
import { NOTIF_KEYS, NOTIF_LABELS } from "@/lib/types";

const noop = () => () => undefined;
const serverPerm = () => "default" as const;

const HINTS: Record<Exclude<EnableResult, { ok: true }>["reason"], string> = {
  denied: "Notifications are blocked for this site. In Chrome, tap the lock icon by the address bar → Permissions → Notifications → Allow, then try again.",
  unsupported: "This browser can't receive web push. On Android, install Tincan to the home screen from Chrome.",
  no_service_worker: "Push needs the installed app or the production build; it's off in development.",
  failed: "Couldn't register this device for push. Check your connection and try again.",
};

/** Master switch, per-type toggles, test button. Everything persists on users/{me}.notif. */
export function NotificationsCard() {
  const { uid, me } = usePair();
  const permission = useSyncExternalStore(noop, permissionState, serverPerm);
  const enabled = me.notif?.enabled === true;
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(permission === "denied" ? HINTS.denied : null);
  const [testState, setTestState] = useState<"idle" | "sent">("idle");
  const [open, setOpen] = useState(false);
  const offCount = NOTIF_KEYS.filter((k) => me.notif?.[k] === false).length;

  async function toggleMaster(next: boolean) {
    setBusy(true);
    setHint(null);
    try {
      if (next) {
        const result = await enablePush(uid);
        if (!result.ok) setHint(HINTS[result.reason]);
      } else {
        await disablePush(uid);
      }
    } finally {
      setBusy(false);
    }
  }

  function toggleType(key: (typeof NOTIF_KEYS)[number], value: boolean) {
    void updateDoc(userRef(uid), { [`notif.${key}`]: value }).catch(swallow);
  }

  async function sendTest() {
    setTestState("sent");
    await notify("test", { toSelf: true });
    setTimeout(() => setTestState("idle"), 4000);
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-xl" aria-hidden>
          🔔
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-tight">Push notifications</h2>
          <p className="text-xs text-muted">{enabled ? "On for this device" : "Off — turn on to hear from them"}</p>
        </div>
        <Switch checked={enabled} onChange={toggleMaster} disabled={busy} aria-label="Push notifications" />
      </div>
      {hint && (
        <p role="alert" className="rounded-2xl bg-surface-2 px-3 py-2 text-xs text-muted">
          {hint}
        </p>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="tap -mx-1 flex items-center gap-3 rounded-2xl px-1 py-2 text-left hover:bg-surface-2"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Customise</span>
          <span className="block text-xs text-muted">
            {offCount === 0 ? "All types on" : `${offCount} ${offCount === 1 ? "type" : "types"} off`} · test notification
          </span>
        </span>
        <ChevronRight size={18} aria-hidden className={cn("shrink-0 text-muted transition-transform", open && "rotate-90")} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <m.div
            key="types"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 34 }}
            className="overflow-hidden"
          >
            <ul className={enabled ? "" : "opacity-50"}>
              {NOTIF_KEYS.map((key) => {
                const on = me.notif?.[key] !== false;
                return (
                  <li key={key} className="flex items-center justify-between gap-3 py-2">
                    <label htmlFor={`notif-${key}`} className="text-sm font-semibold">
                      {NOTIF_LABELS[key]}
                    </label>
                    <Switch id={`notif-${key}`} checked={on} onChange={(v) => toggleType(key, v)} disabled={!enabled} />
                  </li>
                );
              })}
            </ul>

            <Button variant="soft" onClick={sendTest} disabled={!enabled || testState === "sent"} className="mt-2 self-start">
              <BellRing size={18} aria-hidden />
              {testState === "sent" ? "Sent — check in a moment" : "Send me a test notification"}
            </Button>
            {enabled && (
              <p className="mt-2 text-xs text-muted">
                Tip: background the app before the test arrives to see the system notification; in the foreground it shows as a toast.
              </p>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
