"use client";

import { Mic, RefreshCw, X } from "lucide-react";

import { ProgressRing } from "@/components/chat/media/ProgressRing";
import type { Upload } from "@/hooks/useUploads";
import { formatClock } from "@/lib/media/recorder";


/** Placeholder for an outgoing photo or voice note while it compresses and uploads. */
export function UploadBubble({ upload, onRetry, onDismiss }: { upload: Upload; onRetry: () => void; onDismiss: () => void }) {
  const failed = upload.error !== null;
  return (
    <div className="flex w-full justify-end">
      <div className="relative max-w-[82%] overflow-hidden rounded-[20px] rounded-br-md bg-accent-soft p-1 shadow-sm">
        {upload.kind === "image" && upload.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL
          <img src={upload.previewUrl} alt="" width={240} height={240} decoding="async" className="block max-h-72 w-60 rounded-[16px] object-cover opacity-80" />
        ) : (
          <div className="flex w-56 items-center gap-3 px-3 py-3">
            <Mic size={18} className="text-muted" />
            <span className="text-sm font-semibold">Voice note</span>
            {upload.durationMs !== undefined && <span className="ml-auto text-xs text-muted">{formatClock(upload.durationMs)}</span>}
          </div>
        )}
        {upload.caption && <p className="px-2.5 py-1.5 text-[15px]">{upload.caption}</p>}
        <div className="absolute inset-0 grid place-items-center">
          {failed ? (
            <div className="flex items-center gap-2 rounded-full bg-bg/90 px-2 py-1 shadow">
              <button type="button" onClick={onRetry} aria-label="Retry upload" className="tap grid size-9 place-items-center rounded-full text-text">
                <RefreshCw size={16} />
              </button>
              <button type="button" onClick={onDismiss} aria-label="Discard" className="tap grid size-9 place-items-center rounded-full text-muted">
                <X size={16} />
              </button>
            </div>
          ) : (
            <ProgressRing fraction={upload.progress} />
          )}
        </div>
      </div>
    </div>
  );
}
