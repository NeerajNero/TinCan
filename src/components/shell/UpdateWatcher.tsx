"use client";

import { useEffect } from "react";

import { useToast } from "@/components/toast/ToastProvider";

const RECHECK_MIN_MS = 60_000;

/**
 * Gets new deploys onto installed PWAs promptly. The worker already calls
 * skipWaiting + clientsClaim, so a new one takes over as soon as it installs;
 * this asks the browser to look for one on launch and on every resume (Android
 * keeps PWAs alive for days), and once a new worker controls the page it offers
 * a reload so the running JS matches the new build. A worker stuck in
 * "waiting" (an older one without skipWaiting) is told to skip.
 */
export function UpdateWatcher() {
  const { toast } = useToast();

  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV === "development") return;
    const sw = navigator.serviceWorker;
    const hadController = Boolean(sw.controller);
    let lastCheck = 0;

    const offerReload = () =>
      toast({ key: "update", emoji: "✨", title: "Update available", body: "Tap to reload", durationMs: 30_000, vibrate: false, onTap: () => window.location.reload() });

    const check = async () => {
      if (Date.now() - lastCheck < RECHECK_MIN_MS) return;
      lastCheck = Date.now();
      const reg = await sw.getRegistration("/").catch(() => undefined);
      if (!reg) return;
      if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
      await reg.update().catch(() => undefined);
    };

    // A new worker took control: only an *update* if there was one before (not the first install).
    const onControllerChange = () => {
      if (hadController) offerReload();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) void check();
    };

    sw.addEventListener("controllerchange", onControllerChange);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    void check();
    return () => {
      sw.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [toast]);

  return null;
}
