"use client";

import { useEffect } from "react";

import { useToast } from "@/components/toast/ToastProvider";
import { isPermissionDenied, subscribeFirebaseFailures } from "@/lib/diagLog";

/**
 * Development only (AuthGate mounts it under `NODE_ENV === "development"`):
 * a Firestore or RTDB operation the rules refused shows as a toast, so a
 * missing rule is noticed on the first tap instead of as a silent stall.
 * Production keeps the same facts in More → Diagnostics.
 */
export function WriteFailureToasts() {
  const { toast } = useToast();
  useEffect(
    () =>
      subscribeFirebaseFailures((f) => {
        if (!isPermissionDenied(f.code)) return;
        toast({ key: `firebase:${f.kind}:${f.path}`, emoji: "⛔", title: `${f.kind === "read" ? "Read" : "Write"} rejected: ${f.op} ${f.path}`, body: `${f.code} — check rules/*.tmpl`, url: "/more", durationMs: 8000, vibrate: false });
      }),
    [toast],
  );
  return null;
}
