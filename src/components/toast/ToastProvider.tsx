"use client";

import { AnimatePresence, m, type PanInfo } from "framer-motion";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Z } from "@/components/ui/Portal";
import { cn } from "@/lib/cn";
import type { UserDoc } from "@/lib/types";

interface ToastAction {
  label: string;
  onPress: () => void;
  primary?: boolean;
}

export interface ToastInput {
  /** Collapses an earlier toast with the same key (e.g. repeated pings). */
  key?: string;
  emoji?: string;
  avatar?: Pick<UserDoc, "photoURL" | "avatar"> | null;
  title: string;
  body?: string;
  /** Where a tap goes. */
  url?: string;
  /** Instead of navigating, run this on tap (e.g. reload for an update). */
  onTap?: () => void;
  /** Buttons under the text (invites: Join / Not now). Pressing one dismisses the toast. */
  actions?: ToastAction[];
  /** Lamp colour dot, ping bounce, etc. */
  accent?: string;
  bounce?: boolean;
  durationMs?: number;
  /** Stays until tapped, actioned or swiped away (the update offer). Never pushed out by newer toasts. */
  persistent?: boolean;
  vibrate?: boolean;
}

interface Toast extends ToastInput {
  id: number;
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
const MAX_STACK = 3;
const DEFAULT_MS = 4200;

/** One top-of-screen toast stack for the whole app: live events and foreground pushes. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const router = useRouter();

  const remove = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setToasts((list) => list.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = Date.now() + Math.random();
      setToasts((list) => {
        const kept = input.key ? list.filter((x) => x.key !== input.key) : list;
        const next = [...kept, { ...input, id }];
        // Over the cap, drop the oldest non-persistent toasts first.
        while (next.length > MAX_STACK) {
          const i = next.findIndex((x) => !x.persistent);
          if (i === -1) break;
          next.splice(i, 1);
        }
        return next;
      });
      if (!input.persistent) {
        timers.current.set(
          id,
          setTimeout(() => remove(id), input.durationMs ?? DEFAULT_MS),
        );
      }
      if (input.vibrate !== false) {
        try {
          navigator.vibrate?.(40);
        } catch {
          // no haptics
        }
      }
    },
    [remove],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 top-[max(env(safe-area-inset-top),10px)] mx-auto flex max-w-[456px] flex-col gap-2" style={{ zIndex: Z.toast }} aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastCard
              key={t.id}
              toast={t}
              onDismiss={() => remove(t.id)}
              onTap={() => {
                remove(t.id);
                if (t.onTap) t.onTap();
                else if (t.url) router.push(t.url);
              }}
            />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss, onTap }: { toast: Toast; onDismiss: () => void; onTap: () => void }) {
  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y < -40 || info.velocity.y < -400) onDismiss();
  }
  const actions = toast.actions ?? [];
  return (
    <m.div
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.6, bottom: 0 }}
      dragSnapToOrigin
      onDragEnd={onDragEnd}
      layout
      initial={{ y: -70, opacity: 0, scale: 0.96 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -40, opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 480, damping: 34 }}
      className="card pointer-events-auto flex w-full flex-col gap-2 rounded-[20px] px-3.5 py-2.5 shadow-lg"
      role="status"
    >
      <button type="button" onClick={onTap} className="flex w-full items-center gap-3 text-left">
        {toast.avatar ? (
          <Avatar user={toast.avatar} size={36} />
        ) : (
          <m.span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-xl"
            animate={toast.bounce ? { y: [0, -6, 0], rotate: [0, -12, 12, 0] } : { y: 0, rotate: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", repeat: toast.bounce ? 1 : 0 }}
          >
            {toast.emoji ?? "🥫"}
          </m.span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            {toast.accent && <span aria-hidden className="size-2.5 rounded-full" style={{ background: toast.accent, boxShadow: `0 0 8px ${toast.accent}` }} />}
            <span className={cn("truncate font-heading text-[15px] font-semibold")}>{toast.title}</span>
          </span>
          {toast.body && <span className="block truncate text-sm text-muted">{toast.body}</span>}
        </span>
      </button>
      {actions.length > 0 && (
        <div className="flex justify-end gap-2">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => {
                onDismiss();
                a.onPress();
              }}
              className={cn("tap min-h-11 rounded-full px-4 text-sm font-bold", a.primary ? "bg-accent text-accent-ink" : "bg-surface-2 text-text")}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </m.div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
