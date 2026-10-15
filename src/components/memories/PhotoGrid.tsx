"use client";

import Image from "next/image";
import { useState } from "react";

import { ImageViewer } from "@/components/chat/media/ImageViewer";
import { cn } from "@/lib/cn";
import { thumbUrl } from "@/lib/cloudinary";
import type { MediaItem } from "@/lib/types";

/** Thumbnails that open the full-screen viewer. */
export function PhotoGrid({ media, className }: { media: MediaItem[]; className?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  if (media.length === 0) return null;
  return (
    <>
      <div className={cn("grid gap-1", media.length === 1 ? "grid-cols-1" : "grid-cols-2", className)}>
        {media.map((m) => (
          <button key={m.publicId} type="button" onClick={() => setOpen(m.url)} aria-label="Open photo" className="overflow-hidden rounded-2xl bg-surface-2">
            <Image src={thumbUrl(m.url)} alt="" width={m.w} height={m.h} unoptimized className="h-40 w-full object-cover" />
          </button>
        ))}
      </div>
      <ImageViewer src={open} onClose={() => setOpen(null)} />
    </>
  );
}
