"use client";

import { m } from "framer-motion";
import { Clock, ImagePlus, Mic, Send, SmilePlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AttachmentStrip } from "@/components/chat/media/AttachmentStrip";
import { MediaPanel } from "@/components/chat/media/MediaPanel";
import { useTypingWriter } from "@/hooks/useTyping";
import { cn } from "@/lib/cn";
import { autoGrow, enterSends } from "@/lib/composerKeys";
import { MAX_TEXT } from "@/lib/db/messages";
import { focusNoScroll } from "@/lib/focus";
import type { Gif } from "@/lib/giphy";
import {
  formatClock,
  recordingSupported,
  VoiceRecorder,
  type Recording,
} from "@/lib/media/recorder";
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
  onSendImages: (files: File[], caption: string) => void;
  onSendVoice: (recording: Recording) => void;
  onSendSticker: (id: string) => void;
  onSendGif: (gif: Gif) => void;
  /** Opens the "send later" sheet with the current draft; the parent owns the sheet. */
  onSchedule: (draft: string) => void;
  /** The textarea got focus (the keyboard is about to open). */
  onFocusInput?: () => void;
}

const MAX_ROWS = 6;
const CANCEL_SLIDE_PX = 80;
const MIN_VOICE_MS = 600;

export function Composer(props: ComposerProps) {
  const {
    uid,
    friendName,
    replyTo,
    editing,
    onCancelReply,
    onCancelEdit,
    onSend,
    onSaveEdit,
    onSendImages,
    onSendVoice,
    onSendSticker,
    onSendGif,
    onSchedule,
    onFocusInput,
  } = props;
  // The parent re-keys this component per edit target, so the initial value is enough.
  const [text, setText] = useState(() => editing?.text ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [panel, setPanel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState<RecView>({
    recording: false,
    cancelling: false,
    elapsed: 0,
    denied: false,
  });
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const typing = useTypingWriter(uid);

  useEffect(() => {
    const el = textarea.current;
    if (!editing || !el) return;
    focusNoScroll(el);
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  useEffect(() => {
    if (replyTo) focusNoScroll(textarea.current);
  }, [replyTo]);

  // Auto-grow up to MAX_ROWS lines.
  useEffect(() => {
    autoGrow(textarea.current, MAX_ROWS);
  }, [text]);

  const trimmed = text.trim();
  const canSend =
    !busy &&
    (files.length > 0 ||
      (trimmed.length > 0 && (!editing || trimmed !== editing.text)));
  const showMic =
    !editing &&
    files.length === 0 &&
    trimmed.length === 0 &&
    recordingSupported();

  async function submit() {
    if (!canSend) return;
    setBusy(true);
    typing.clear();
    const value = trimmed;
    try {
      if (editing) {
        await onSaveEdit(editing, value);
      } else if (files.length > 0) {
        const picked = files;
        setFiles([]);
        setText("");
        onSendImages(picked, value);
      } else {
        setText("");
        await onSend(value);
      }
    } finally {
      setBusy(false);
      focusNoScroll(textarea.current);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape" && editing) onCancelEdit();
    if (!enterSends(e)) return;
    e.preventDefault();
    void submit();
  }

  function insertEmoji(emoji: string) {
    const el = textarea.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const next = `${text.slice(0, start)}${emoji}${text.slice(end)}`.slice(
      0,
      MAX_TEXT,
    );
    setText(next);
    queueMicrotask(() => {
      focusNoScroll(el);
      el?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  function pickFiles(list: FileList | null) {
    if (!list) return;
    const images = Array.from(list).filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => [...prev, ...images].slice(0, 10));
    setPanel(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  const strip = editing
    ? { label: "Editing", body: editing.text, onClose: onCancelEdit }
    : replyTo
      ? {
          label: `Replying to ${replyTo.senderId === uid ? "yourself" : friendName}`,
          body: replyTo.deletedForEveryone
            ? "This message was deleted"
            : replyTo.text || replyTo.type,
          onClose: onCancelReply,
        }
      : null;

  return (
    <div className="border-t border-border bg-bg/90 backdrop-blur-md">
      <div className="px-3 pt-2 pb-[max(env(safe-area-inset-bottom),8px)]">
        {strip && (
          <div className="mb-2 flex items-start gap-2 rounded-2xl border-l-4 border-[var(--accent)] bg-surface px-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[var(--accent)]">
                {strip.label}
              </p>
              <p className="line-clamp-2 text-muted">{strip.body}</p>
            </div>
            <button
              type="button"
              onClick={strip.onClose}
              aria-label="Cancel"
              className="tap -m-2 grid size-9 place-items-center text-muted"
            >
              <X size={16} />
            </button>
          </div>
        )}
        {files.length > 0 && (
          <AttachmentStrip
            files={files}
            onRemove={(i) => setFiles((f) => f.filter((_, idx) => idx !== i))}
          />
        )}

        <div className="flex items-end gap-1.5">
          {rec.recording ? (
            <div
              className={cn(
                "flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[22px] px-4 text-sm transition-colors",
                rec.cancelling ? "bg-red-500/15 text-red-500" : "bg-surface",
              )}
              aria-live="polite"
            >
              <span
                className="size-2.5 shrink-0 animate-pulse rounded-full bg-red-500"
                aria-hidden
              />
              <span className="font-bold tabular-nums">
                {formatClock(rec.elapsed)}
              </span>
              <span className="ml-auto truncate text-muted">
                {rec.cancelling
                  ? "Release to cancel"
                  : "◀ Slide left to cancel"}
              </span>
            </div>
          ) : (
            <>
              {!editing && (
                <>
                  <button
                    type="button"
                    onClick={() => setPanel((v) => !v)}
                    aria-label="Emoji, stickers and GIFs"
                    aria-expanded={panel}
                    className={cn(
                      "tap grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2",
                      panel && "bg-accent-soft text-text",
                    )}
                  >
                    <SmilePlus size={22} />
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    aria-label="Attach photo"
                    className="tap grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2"
                  >
                    <ImagePlus size={22} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSchedule(text);
                      setText("");
                    }}
                    aria-label="Send later"
                    className="tap grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2"
                  >
                    <Clock size={22} />
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(e) => pickFiles(e.target.files)}
                  />
                </>
              )}
              <textarea
                ref={textarea}
                value={text}
                rows={1}
                maxLength={MAX_TEXT}
                placeholder={files.length ? "Add a caption…" : "Say something…"}
                aria-label="Message"
                enterKeyHint="enter"
                onChange={(e) => {
                  setText(e.target.value);
                  if (e.target.value.trim()) typing.ping();
                }}
                onKeyDown={onKeyDown}
                onFocus={() => {
                  setPanel(false);
                  onFocusInput?.();
                }}
                onBlur={typing.clear}
                className={cn(
                  "max-h-[164px] min-h-11 flex-1 resize-none rounded-[22px] border border-border bg-surface px-4 py-2.5 text-[15px] leading-[22px]",
                  "placeholder:text-muted/70 focus:border-[var(--accent)] focus:outline-none",
                )}
              />
            </>
          )}
          {showMic ? (
            <RecordButton onRecorded={onSendVoice} onViewChange={setRec} />
          ) : (
            <m.button
              type="button"
              onClick={submit}
              disabled={!canSend}
              aria-label={editing ? "Save" : "Send"}
              whileTap={{ scale: 0.9 }}
              className="tap grid size-11 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-white shadow-md disabled:opacity-40"
            >
              <Send size={18} className={editing ? "" : "-ml-0.5"} />
            </m.button>
          )}
        </div>
        {rec.denied && !rec.recording && (
          <p className="mt-1 text-right text-[11px] text-muted">
            Microphone access was blocked.
          </p>
        )}
        {text.length > MAX_TEXT - 200 && (
          <p className="mt-1 text-right text-[11px] text-muted">
            {text.length}/{MAX_TEXT}
          </p>
        )}
      </div>
      {panel && !editing && (
        <MediaPanel
          onEmoji={insertEmoji}
          onSticker={(id) => {
            onSendSticker(id);
            setPanel(false);
          }}
          onGif={(gif) => {
            onSendGif(gif);
            setPanel(false);
          }}
        />
      )}
    </div>
  );
}

/* ── hold-to-record mic ────────────────────────────────────────────────── */

type RecState =
  | { phase: "idle" }
  | { phase: "starting" }
  | { phase: "recording"; cancelling: boolean };

/** What the composer needs to draw the recording row. */
interface RecView {
  recording: boolean;
  cancelling: boolean;
  elapsed: number;
  denied: boolean;
}

function RecordButton({
  onRecorded,
  onViewChange,
}: {
  onRecorded: (rec: Recording) => void;
  onViewChange: (view: RecView) => void;
}) {
  const [state, setState] = useState<RecState>({ phase: "idle" });
  const [elapsed, setElapsed] = useState(0);
  const [denied, setDenied] = useState(false);

  const recording = state.phase === "recording";
  const cancelling = state.phase === "recording" && state.cancelling;
  useEffect(() => {
    onViewChange({ recording, cancelling, elapsed, denied });
  }, [recording, cancelling, elapsed, denied, onViewChange]);
  const recorder = useRef<VoiceRecorder | null>(null);
  const startX = useRef(0);
  const released = useRef(false);
  const cancelled = useRef(false);

  useEffect(() => {
    if (state.phase !== "recording") return;
    const id = setInterval(
      () => setElapsed(recorder.current?.elapsedMs ?? 0),
      200,
    );
    return () => clearInterval(id);
  }, [state.phase]);

  async function finish() {
    const rec = recorder.current;
    recorder.current = null;
    setState({ phase: "idle" });
    setElapsed(0);
    if (!rec) return;
    if (cancelled.current || rec.elapsedMs < MIN_VOICE_MS) {
      rec.cancel();
      return;
    }
    try {
      const clip = await rec.stop();
      onRecorded(clip);
    } catch {
      // Nothing recorded.
    }
  }

  async function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (state.phase !== "idle") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startX.current = e.clientX;
    released.current = false;
    cancelled.current = false;
    setDenied(false);
    setState({ phase: "starting" });
    const rec = new VoiceRecorder();
    try {
      await rec.start(() => void finish());
    } catch {
      setDenied(true);
      setState({ phase: "idle" });
      return;
    }
    if (released.current) {
      rec.cancel();
      setState({ phase: "idle" });
      return;
    }
    recorder.current = rec;
    try {
      navigator.vibrate?.(15);
    } catch {
      // no haptics
    }
    setState({ phase: "recording", cancelling: false });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (state.phase !== "recording") return;
    const dx = e.clientX - startX.current;
    const cancelling = dx < -CANCEL_SLIDE_PX;
    if (cancelling !== state.cancelling)
      setState({ phase: "recording", cancelling });
  }

  function onPointerUp() {
    released.current = true;
    if (state.phase === "recording") {
      cancelled.current = state.cancelling;
      void finish();
    }
  }

  function onPointerCancel() {
    released.current = true;
    cancelled.current = true;
    void finish();
  }

  return (
    <m.button
      type="button"
      aria-label={
        recording ? "Release to send voice note" : "Hold to record a voice note"
      }
      aria-pressed={recording}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onContextMenu={(e) => e.preventDefault()}
      animate={recording ? { scale: 1.25 } : { scale: 1 }}
      className={cn(
        "tap grid size-11 shrink-0 place-items-center rounded-full shadow-md select-none touch-none",
        recording ? "bg-red-500 text-white" : "bg-[var(--accent)] text-white",
      )}
    >
      <Mic size={18} />
    </m.button>
  );
}
