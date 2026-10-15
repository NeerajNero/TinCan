"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { usePair } from "@/hooks/usePair";
import { onForegroundMessage, refreshPushToken } from "@/lib/push";

interface Toast {
  id: number;
  title: string;
  body: string;
  url: string;
}

/**
 * Mounted once inside the pair provider: refreshes this device's token on
 * open while push is enabled, and turns foreground pushes into a tappable
 * toast unless the user is already on that screen.
 */
export function PushController() {
  const { uid, me } = usePair();
  const pathname = usePathname();
  const router = useRouter();
  const [toast, setToast] = useState<Toast | null>(null);
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
      if (d.type !== "test" && pathRef.current === url) return; // already looking at it
      setToast({ id: Date.now(), title: d.title || "Tincan", body: d.body || "", url });
    }).then((u) => {
      if (cancelled) u();
      else unsub = u;
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.button
          key={toast.id}
          type="button"
          onClick={() => {
            setToast(null);
            router.push(toast.url);
          }}
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          className="card fixed inset-x-3 top-[max(env(safe-area-inset-top),12px)] z-50 mx-auto flex max-w-[456px] items-center gap-3 rounded-[20px] px-4 py-3 text-left shadow-lg"
          role="status"
          aria-live="polite"
        >
          <span className="text-2xl" aria-hidden>
            🥫
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-heading text-base font-semibold">{toast.title}</span>
            {toast.body && <span className="block truncate text-sm text-muted">{toast.body}</span>}
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
