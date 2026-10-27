"use client";

import { Check, ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Sheet } from "@/components/ui/Sheet";
import { CHAT_BACKGROUNDS } from "@/content/chat-backgrounds";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/cn";
import { memoriesQuery } from "@/lib/db/memories";
import { setPairChatBg } from "@/lib/db/pair";
import { getDocs } from "@/lib/firebase/fs";
import { chatBgPhotoUrl, variantUrl } from "@/lib/mediaUrl";
import { swallow } from "@/lib/swallow";
import type { ChatBgPref } from "@/lib/types";
interface PickerProps {
  open: boolean;
  uid: string;
  /** The other person, named in "Shared with …". */
  friendName: string;
  current: ChatBgPref | null | undefined;
  onClose: () => void;
}

interface MemoryThumb {
  id: string;
  /** Signed (or legacy public) thumbnail and background variants of the memory. */
  thumb: string;
  background: string;
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
export function ChatBackgroundPicker({ open, uid, friendName, current, onClose }: PickerProps) {
  const { resolved } = useTheme();
  const [photos, setPhotos] = useState<MemoryThumb[] | null>(null);
  const [choosingPhoto, setChoosingPhoto] = useState(false);
  const currentId = current?.id ?? "plain";
  const currentPhoto = current?.id === "photo" ? chatBgPhotoUrl(current.photoUrl) : null;

  // One bounded read of the latest memories, only when the photo panel opens.
  useEffect(() => {
    if (!choosingPhoto || photos) return;
    let cancelled = false;
    getDocs(memoriesQuery(null))
      .then((snap) => {
        if (cancelled) return;
        setPhotos(
          snap.docs.flatMap((d) => {
            const m = d.data();
            const thumb = variantUrl(m, "w320");
            const background = variantUrl(m, "w640");
            return thumb && background ? [{ id: d.id, thumb, background, publicId: m.publicId }] : [];
          }),
        );
      })
      .catch(() => !cancelled && setPhotos([]));
    return () => {
      cancelled = true;
    };
  }, [choosingPhoto, photos]);

  function pick(pref: ChatBgPref) {
    void setPairChatBg(uid, pref.id === "plain" ? null : pref).catch(swallow);
    if (pref.id === "photo") setChoosingPhoto(false);
  }
  function close() {
    setChoosingPhoto(false);
    onClose();
  }

  return (
          <Sheet open={open} onClose={close} label="Chat background" maxHeight="80dvh">
            <div className="mb-3 flex items-center justify-between">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">{choosingPhoto ? "Pick a memory" : "Chat wallpaper"}</h2>
                <p className="text-xs text-muted">Shared with {friendName} — you both see the same one</p>
              </div>
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
                      <img src={currentPhoto} alt="" decoding="async" loading="lazy" className="h-full w-full object-cover" />
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
                  <button key={p.id} type="button" onClick={() => pick({ id: "photo", photoUrl: p.background, photoPublicId: p.publicId })} aria-label="Use this photo" className={cn("aspect-square overflow-hidden rounded-xl border-2 bg-surface-2", current?.photoPublicId === p.publicId ? "border-[var(--accent)]" : "border-transparent")}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary thumbnail */}
                    <img src={p.thumb} alt="" decoding="async" loading="lazy" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </Sheet>
  );
}
