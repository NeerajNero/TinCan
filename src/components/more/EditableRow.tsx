"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/cn";

interface EditableRowProps {
  emoji: string;
  label: string;
  /** Current value shown on the row; falls back to `placeholder` in muted text. */
  value?: string | null;
  placeholder?: string;
  disabled?: boolean;
  hint?: string;
  /** Inline editor rendered when the row is open. Call `close()` once saved. */
  children?: (close: () => void) => React.ReactNode;
}

/** A settings row that opens an inline editor beneath it. */
export function EditableRow({ emoji, label, value, placeholder = "Not set", disabled, hint, children }: EditableRowProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-expanded={open}
        className={cn(
          "tap flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left",
          disabled ? "cursor-not-allowed opacity-50" : "hover:bg-surface-2",
        )}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-xl" aria-hidden>
          {emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold uppercase tracking-wide text-muted">{label}</span>
          <span className={cn("block truncate", value ? "font-semibold" : "text-muted")}>{value || placeholder}</span>
          {hint && <span className="block text-xs text-muted">{hint}</span>}
        </span>
        {!disabled && (
          <ChevronRight
            size={18}
            aria-hidden
            className={cn("shrink-0 text-muted transition-transform", open && "rotate-90")}
          />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && children && (
          <motion.div
            key="editor"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 34 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 px-2 pt-1 pb-3">{children(close)}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
