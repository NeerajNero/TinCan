"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { LIVE_PUSH_TYPES } from "@/components/live/LiveEventsProvider";
import { useToast } from "@/components/toast/ToastProvider";
import { usePair } from "@/hooks/usePair";
import { onForegroundMessage, refreshPushToken } from "@/lib/push";

/**
 * Refreshes this device's token on open while push is enabled, and turns
 * foreground pushes into toasts — except the types the live-events layer
 * already shows instantly, so nothing appears twice.
 */
export function PushController() {
  const { uid, me } = usePair();
  const { toast } = useToast();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  const enabled = me.notif?.enabled === true;
  useEffect(() => {
    if (!enabled) return;
    void refreshPushToken(uid);
  }, [enabled, uid]);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let cancelled = false;
    void onForegroundMessage((payload) => {
      const d = payload.data ?? {};
      const url = d.url || "/";
      if (LIVE_PUSH_TYPES.has(d.type ?? "")) return;
      if (d.type !== "test" && pathRef.current === url) return; // already looking at it
      toast({ key: `push:${d.type ?? "x"}`, emoji: "🔔", title: d.title || "Tincan", body: d.body || "", url });
    }).then((u) => {
      if (cancelled) u();
      else unsub = u;
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [toast]);

  return null;
}
