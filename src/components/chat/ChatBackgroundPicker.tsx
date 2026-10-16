"use client";

import { AnimatePresence, m } from "framer-motion";
import { Check, ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { CHAT_BACKGROUNDS } from "@/content/chat-backgrounds";
import { useTheme } from "@/hooks/useTheme";
import { thumbUrl } from "@/lib/cloudinary";
import { cn } from "@/lib/cn";
import { memoriesQuery } from "@/lib/db/memories";
import { setChatBg } from "@/lib/db/users";
import { getDocs } from "@/lib/firebase/fs";
import { safeCloudinary } from "@/lib/safeUrl";
import { swallow } from "@/lib/swallow";
import type { ChatBgPref } from "@/lib/types";
interface PickerProps {
  open: boolean;
  uid: string;
  current: ChatBgPref | null | undefined;
  onClose: () => void;
}

interface MemoryThumb {
  id: string;
  url: string;
  publicId: string;
}

/** Two tiny bubbles so a thumbnail shows how messages will read on it. */
function MiniBubbles() {
  return (
    <div aria-hidden className="absolute inset-0 flex flex-col justify-end gap-1 p-1.5">
      <span className="h-2.5 w-3/5 self-start rounded-full bg-[var(--bubble-theirs)] shadow-[0_1px_2px_rgba(0,0,0,0.15)]" />
      <span className="h-2.5 w-2/3 self-end rounded-full bg-[var(--bubble-mine)] shadow-[0_1px_2px_rgba(0,0,0,0.15)]" />
    </div>
  );
}

/** Bottom sheet: the eight built-ins plus a photo from Memories, with live previews. */
export function ChatBackgroundPicker({ open, uid, current, onClose }: PickerProps) {
  const { resolved } = useTheme();
  const [photos, setPhotos] = useState<MemoryThumb[] | null>(null);
  const [choosingPhoto, setChoosingPhoto] = useState(false);
  const currentId = current?.id ?? "plain";
  const currentPhoto = current?.id === "photo" ? safeCloudinary(current.photoUrl) : null;

  // One bounded read of the latest memories, only when the photo panel opens.
  useEffect(() => {
    if (!choosingPhoto || photos) return;
    let cancelled = false;
    getDocs(memoriesQuery(null))
      .then((snap) => {
        if (cancelled) return;
        setPhotos(snap.docs.map((d) => ({ id: d.id, url: d.data().url, publicId: d.data().publicId })).filter((p) => safeCloudinary(p.url)));
      })
      .catch(() => !cancelled && setPhotos([]));
    return () => {
      cancelled = true;
    };
  }, [choosingPhoto, photos]);

  function pick(pref: ChatBgPref) {
    void setChatBg(uid, pref.id === "plain" ? null : pref).catch(swallow);
    if (pref.id === "photo") setChoosingPhoto(false);
  }
  function close() {
    setChoosingPhoto(false);
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <m.button key="backdrop" type="button" aria-label="Close" onClick={close} className="fixed inset-0 z-40 bg-black/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <m.div
            key="sheet"
            role="dialog"
            aria-label="Chat background"
            className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[80dvh] w-full max-w-[480px] flex-col rounded-t-[28px] bg-surface p-4 pb-[max(env(safe-area-inset-bottom),16px)] shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.3)]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border" aria-hidden />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{choosingPhoto ? "Pick a memory" : "Chat background"}</h2>
              {choosingPhoto && (
                <button type="button" onClick={() => setChoosingPhoto(false)} className="tap rounded-full px-3 text-sm font-bold text-muted">
                  Back
                </button>
              )}
            </div>

            {!choosingPhoto ? (
              <div className="grid grid-cols-3 gap-3 overflow-y-auto">
                {CHAT_BACKGROUNDS.map((bg) => {
                  const active = currentId === bg.id;
                  return (
                    <button key={bg.id} type="button" onClick={() => pick({ id: bg.id })} aria-pressed={active} className="flex flex-col items-center gap-1.5">
                      <span className={cn("relative block aspect-[3/4] w-full overflow-hidden rounded-2xl border-2", active ? "border-[var(--accent)]" : "border-border")} style={bg.style(resolved)}>
                        <MiniBubbles />
                        {active && (
                          <span className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-[var(--accent)] text-white">
                            <Check size={12} strokeWidth={3} />
                          </span>
                        )}
                      </span>
                      <span className="text-xs font-bold">
                        {bg.emoji} {bg.name}
                      </span>
                    </button>
                  );
                })}
                <button type="button" onClick={() => setChoosingPhoto(true)} aria-pressed={currentId === "photo"} className="flex flex-col items-center gap-1.5">
                  <span className={cn("relative block aspect-[3/4] w-full overflow-hidden rounded-2xl border-2 bg-surface-2", currentId === "photo" ? "border-[var(--accent)]" : "border-border")}>
                    {currentPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Cloudinary thumbnail
                      <img src={thumbUrl(currentPhoto)} alt="" decoding="async" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <span className="grid h-full place-items-center text-muted">
                        <ImageIcon size={22} />
                      </span>
                    )}
                    <MiniBubbles />
                    {currentId === "photo" && (
                      <span className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-[var(--accent)] text-white">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <span className="text-xs font-bold">📷 From Memories</span>
                </button>
              </div>
            ) : photos === null ? (
              <p className="py-6 text-center text-sm text-muted">Loading your photos…</p>
            ) : photos.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">No photos in Memories yet — add one there first?</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 overflow-y-auto">
                {photos.map((p) => (
                  <button key={p.id} type="button" onClick={() => pick({ id: "photo", photoUrl: p.url, photoPublicId: p.publicId })} aria-label="Use this photo" className={cn("aspect-square overflow-hidden rounded-xl border-2 bg-surface-2", current?.photoPublicId === p.publicId ? "border-[var(--accent)]" : "border-transparent")}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary thumbnail */}
                    <img src={thumbUrl(p.url)} alt="" decoding="async" loading="lazy" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </m.div>
        </>
      )}
    </AnimatePresence>
  );
}
