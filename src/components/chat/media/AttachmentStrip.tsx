"use client";

import { X } from "lucide-react";
import { useEffect, useMemo } from "react";

import { ViewOnceToggle } from "@/components/chat/media/ViewOnceToggle";

interface AttachmentStripProps {
  files: File[];
  onRemove: (index: number) => void;
  /** View-once (phase 27, chat only): off by default, lives next to the thumbnails so it only shows with something to send. */
  viewOnce?: boolean;
  onToggleViewOnce?: () => void;
}

/** Thumbnails of photos picked but not yet sent, with the view-once toggle at the end of the row when the caller offers one. */
export function AttachmentStrip({ files, onRemove, viewOnce = false, onToggleViewOnce }: AttachmentStripProps) {
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  return (
    <div className="mb-2 flex items-center gap-2 overflow-x-auto px-1 py-1">
      {urls.map((u, i) => (
        <div key={u} className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
          <img src={u} alt="" width={64} height={64} decoding="async" className="size-16 rounded-xl object-cover" />
          <button type="button" onClick={() => onRemove(i)} aria-label="Remove photo" className="absolute -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full bg-text text-bg shadow">
            <X size={12} />
          </button>
        </div>
      ))}
      {onToggleViewOnce && <ViewOnceToggle on={viewOnce} onToggle={onToggleViewOnce} what="photo" />}
    </div>
  );
}
