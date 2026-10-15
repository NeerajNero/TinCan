"use client";

import { ImagePlus } from "lucide-react";
import { useRef } from "react";

import { AttachmentStrip } from "@/components/chat/media/AttachmentStrip";

interface PhotoPickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  max?: number;
  label?: string;
}

/** Pick up to `max` photos; shows a thumbnail strip with remove buttons. */
export function PhotoPicker({ files, onChange, max = 6, label = "Add photos" }: PhotoPickerProps) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-1">
      {files.length > 0 && <AttachmentStrip files={files} onRemove={(i) => onChange(files.filter((_, idx) => idx !== i))} />}
      <button type="button" onClick={() => input.current?.click()} disabled={files.length >= max} className="tap flex items-center gap-2 self-start rounded-full bg-surface-2 px-3 text-sm font-bold text-muted disabled:opacity-50">
        <ImagePlus size={16} aria-hidden />
        {label}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
          onChange([...files, ...picked].slice(0, max));
          e.target.value = "";
        }}
      />
    </div>
  );
}
