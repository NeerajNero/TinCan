"use client";

import { useEffect } from "react";

import { useToast } from "@/components/toast/ToastProvider";
import { getUpdateController } from "@/lib/swUpdate";

/**
 * Mounted on every signed-in screen (AuthGate). Checks for a new deploy on
 * launch and on each resume (once an hour at most), and whenever a worker is
 * waiting shows the persistent "Update available · Reload" toast. Reload hands
 * over to the new worker and reloads once; nothing updates silently.
 */
export function UpdateWatcher() {
  const { toast } = useToast();

  useEffect(() => {
    const ctl = getUpdateController();
    const offer = () =>
      toast({
        key: "update",
        emoji: "✨",
        title: "Update available",
        body: "A newer build is ready",
        persistent: true,
        vibrate: false,
        actions: [{ label: "Reload", primary: true, onPress: () => void ctl.apply() }],
      });
    const unsubscribe = ctl.subscribe((s) => {
      if (s.waiting && !s.checking) offer();
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") void ctl.check();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) void ctl.check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    void ctl.check();
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [toast]);

  return null;
}
