"use client";

import { AnimatePresence, m } from "framer-motion";
import { Copy, Pencil, Reply, Trash2, UserX } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/cn";
import { canEdit } from "@/lib/db/messages";
import { EMOJI_GRID, QUICK_EMOJI } from "@/lib/emoji";
import type { Message } from "@/lib/types";

interface MessageMenuProps {
  message: Message | null;
  uid: string;
  onClose: () => void;
  onReact: (message: Message, emoji: string) => void;
  onReply: (message: Message) => void;
  onEdit: (message: Message) => void;
  onDeleteForMe: (message: Message) => void;
  onDeleteForEveryone: (message: Message) => void;
}

/** Bottom sheet with reactions and actions for one message. */
export function MessageMenu({ message, uid, onClose, onReact, onReply, onEdit, onDeleteForMe, onDeleteForEveryone }: MessageMenuProps) {
  const [moreEmoji, setMoreEmoji] = useState(false);
  const mine = message?.senderId === uid;
  const deleted = message?.deletedForEveryone ?? false;

  function close() {
    setMoreEmoji(false);
    onClose();
  }

  async function copy(m: Message) {
    try {
      await navigator.clipboard.writeText(m.text);
    } catch {
      // Clipboard blocked; nothing to do.
    }
    close();
  }

  return (
    <AnimatePresence>
      {message && (
        <>
          <m.button
            key="backdrop"
            type="button"
            aria-label="Close"
            onClick={close}
            className="fixed inset-0 z-40 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <m.div
            key="sheet"
            role="dialog"
            aria-label="Message options"
            className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[480px] rounded-t-[28px] bg-surface p-4 pb-[max(env(safe-area-inset-bottom),16px)] shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.3)]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border" aria-hidden />

            {!deleted && (
              <div className="mb-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-1">
                  {QUICK_EMOJI.map((emoji) => (
                    <EmojiButton key={emoji} emoji={emoji} active={message.reactions[uid] === emoji} onPick={() => { onReact(message, emoji); close(); }} />
                  ))}
                  <button
                    type="button"
                    onClick={() => setMoreEmoji((v) => !v)}
                    aria-expanded={moreEmoji}
                    aria-label="More emoji"
                    className="tap grid size-11 place-items-center rounded-full bg-surface-2 text-lg font-bold text-muted"
                  >
                    {moreEmoji ? "–" : "+"}
                  </button>
                </div>
                <AnimatePresence initial={false}>
                  {moreEmoji && (
                    <m.div
                      key="grid"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-8 gap-1 pt-1">
                        {EMOJI_GRID.map((emoji) => (
                          <EmojiButton key={emoji} emoji={emoji} active={message.reactions[uid] === emoji} onPick={() => { onReact(message, emoji); close(); }} small />
                        ))}
                      </div>
                    </m.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div className="flex flex-col">
              {!deleted && <Action icon={<Reply size={18} />} label="Reply" onClick={() => { onReply(message); close(); }} />}
              {!deleted && message.text && <Action icon={<Copy size={18} />} label="Copy" onClick={() => copy(message)} />}
              {canEdit(message, uid) && <Action icon={<Pencil size={18} />} label="Edit" onClick={() => { onEdit(message); close(); }} />}
              <Action icon={<UserX size={18} />} label="Delete for me" onClick={() => { onDeleteForMe(message); close(); }} />
              {mine && !deleted && (
                <Action icon={<Trash2 size={18} />} label="Delete for everyone" danger onClick={() => { onDeleteForEveryone(message); close(); }} />
              )}
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  );
}

function EmojiButton({ emoji, active, onPick, small }: { emoji: string; active: boolean; onPick: () => void; small?: boolean }) {
  return (
    <m.button
      type="button"
      onClick={onPick}
      aria-label={`React ${emoji}`}
      aria-pressed={active}
      whileTap={{ scale: 0.8 }}
      className={cn(
        "tap grid place-items-center rounded-full",
        small ? "size-10 text-xl" : "size-11 text-2xl",
        active ? "bg-accent-soft" : "bg-surface-2",
      )}
    >
      {emoji}
    </m.button>
  );
}

function Action({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("tap flex items-center gap-3 rounded-2xl px-3 py-3 text-left font-semibold hover:bg-surface-2", danger && "text-red-500")}
    >
      <span className="text-muted">{icon}</span>
      {label}
    </button>
  );
}
