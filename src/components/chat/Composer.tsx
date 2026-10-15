"use client";

import { motion } from "framer-motion";
import { Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useTypingWriter } from "@/hooks/useTyping";
import { cn } from "@/lib/cn";
import { MAX_TEXT } from "@/lib/db/messages";
import type { Message } from "@/lib/types";

interface ComposerProps {
  uid: string;
  friendName: string;
  replyTo: Message | null;
  editing: Message | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onSend: (text: string) => Promise<void>;
  onSaveEdit: (message: Message, text: string) => Promise<void>;
}

const MAX_ROWS = 6;

function isTouchDevice() {
  return typeof window !== "undefined" && window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}

export function Composer({ uid, friendName, replyTo, editing, onCancelReply, onCancelEdit, onSend, onSaveEdit }: ComposerProps) {
  // The parent re-keys this component per edit target, so the initial value is enough.
  const [text, setText] = useState(() => editing?.text ?? "");
  const [busy, setBusy] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const typing = useTypingWriter(uid);

  useEffect(() => {
    const el = textarea.current;
    if (!editing || !el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  useEffect(() => {
    if (replyTo) textarea.current?.focus();
  }, [replyTo]);

  // Auto-grow up to MAX_ROWS lines.
  useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "0px";
    const line = parseFloat(getComputedStyle(el).lineHeight) || 22;
    el.style.height = `${Math.min(el.scrollHeight, line * MAX_ROWS + 20)}px`;
  }, [text]);

  const trimmed = text.trim();
  const canSend = trimmed.length > 0 && !busy && (!editing || trimmed !== editing.text);

  async function submit() {
    if (!canSend) return;
    setBusy(true);
    typing.clear();
    const value = trimmed;
    try {
      if (editing) {
        await onSaveEdit(editing, value);
      } else {
        setText("");
        await onSend(value);
      }
    } finally {
      setBusy(false);
      textarea.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape" && editing) onCancelEdit();
    if (e.key !== "Enter" || isTouchDevice()) return;
    if (e.shiftKey) return; // newline
    e.preventDefault();
    void submit();
  }

  const strip = editing ? { label: "Editing", body: editing.text, onClose: onCancelEdit } : replyTo ? { label: `Replying to ${replyTo.senderId === uid ? "yourself" : friendName}`, body: replyTo.deletedForEveryone ? "This message was deleted" : replyTo.text, onClose: onCancelReply } : null;

  return (
    <div className="border-t border-border bg-bg/90 px-3 pt-2 pb-[max(env(safe-area-inset-bottom),8px)] backdrop-blur-md">
      {strip && (
        <div className="mb-2 flex items-start gap-2 rounded-2xl border-l-4 border-[var(--accent)] bg-surface px-3 py-2 text-sm">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[var(--accent)]">{strip.label}</p>
            <p className="line-clamp-2 text-muted">{strip.body}</p>
          </div>
          <button type="button" onClick={strip.onClose} aria-label="Cancel" className="tap -m-2 grid size-9 place-items-center text-muted">
            <X size={16} />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={textarea}
          value={text}
          rows={1}
          maxLength={MAX_TEXT}
          placeholder="Say something…"
          aria-label="Message"
          enterKeyHint="enter"
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value.trim()) typing.ping();
          }}
          onKeyDown={onKeyDown}
          onBlur={typing.clear}
          className={cn(
            "max-h-[164px] min-h-11 flex-1 resize-none rounded-[22px] border border-border bg-surface px-4 py-2.5 text-[15px] leading-[22px]",
            "placeholder:text-muted/70 focus:border-[var(--accent)] focus:outline-none",
          )}
        />
        <motion.button
          type="button"
          onClick={submit}
          disabled={!canSend}
          aria-label={editing ? "Save" : "Send"}
          whileTap={{ scale: 0.9 }}
          className="tap grid size-11 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-white shadow-md disabled:opacity-40"
        >
          <Send size={18} className={editing ? "" : "-ml-0.5"} />
        </motion.button>
      </div>
      {text.length > MAX_TEXT - 200 && (
        <p className="mt-1 text-right text-[11px] text-muted">
          {text.length}/{MAX_TEXT}
        </p>
      )}
    </div>
  );
}
