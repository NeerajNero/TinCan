"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { uploadToCloudinary } from "@/lib/cloudinary";
import { sendMedia } from "@/lib/db/messages";
import { compressImage } from "@/lib/media/compress";
import type { Recording } from "@/lib/media/recorder";
import { notify } from "@/lib/notify";
import type { ReplyTo } from "@/lib/types";

export interface Upload {
  id: string;
  kind: "image" | "voice";
  /** Object URL of the local file for the placeholder bubble. */
  previewUrl: string | null;
  progress: number;
  error: string | null;
  w?: number;
  h?: number;
  durationMs?: number;
  caption: string;
}

interface Task {
  run: () => Promise<void>;
}

/**
 * Outgoing media queue: compress → upload with progress → addDoc. Each entry
 * is shown as a placeholder bubble until the Firestore write exists, after
 * which the normal pending-write clock takes over.
 */
export function useUploads(uid: string, friendUid: string) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const tasks = useRef(new Map<string, Task>());
  const previews = useRef(new Map<string, string>());

  const patch = useCallback((id: string, changes: Partial<Upload>) => {
    setUploads((list) => list.map((u) => (u.id === id ? { ...u, ...changes } : u)));
  }, []);

  const remove = useCallback((id: string) => {
    const url = previews.current.get(id);
    if (url) URL.revokeObjectURL(url);
    previews.current.delete(id);
    tasks.current.delete(id);
    setUploads((list) => list.filter((u) => u.id !== id));
  }, []);

  const enqueue = useCallback(
    (upload: Upload, run: () => Promise<void>) => {
      const task: Task = {
        run: async () => {
          patch(upload.id, { error: null, progress: 0 });
          try {
            await run();
            remove(upload.id);
          } catch (err) {
            patch(upload.id, { error: err instanceof Error ? err.message : "failed" });
          }
        },
      };
      tasks.current.set(upload.id, task);
      if (upload.previewUrl) previews.current.set(upload.id, upload.previewUrl);
      setUploads((list) => [...list, upload]);
      void task.run();
    },
    [patch, remove],
  );

  const sendImages = useCallback(
    (files: File[], caption: string, replyTo: ReplyTo | null) => {
      files.forEach((file, index) => {
        const id = `img-${Date.now()}-${index}`;
        const previewUrl = URL.createObjectURL(file);
        enqueue({ id, kind: "image", previewUrl, progress: 0, error: null, caption: index === 0 ? caption : "" }, async () => {
          const { blob, w, h } = await compressImage(file);
          patch(id, { w, h });
          const up = await uploadToCloudinary(blob, { kind: "image", onProgress: (f) => patch(id, { progress: f }) });
          const messageId = await sendMedia(
            uid,
            "image",
            { url: up.url, publicId: up.publicId, w: up.w ?? w, h: up.h ?? h, bytes: up.bytes },
            index === 0 ? caption : "",
            index === 0 ? replyTo : null,
          );
          await notify("message", { toUid: friendUid, body: caption ? `📷 ${caption}` : "📷 Photo", data: { messageId } });
        });
      });
    },
    [enqueue, patch, uid, friendUid],
  );

  const sendVoice = useCallback(
    (rec: Recording, replyTo: ReplyTo | null) => {
      const id = `voice-${Date.now()}`;
      enqueue({ id, kind: "voice", previewUrl: null, progress: 0, error: null, durationMs: rec.durationMs, caption: "" }, async () => {
        const up = await uploadToCloudinary(rec.blob, { kind: "audio", onProgress: (f) => patch(id, { progress: f }) });
        const messageId = await sendMedia(
          uid,
          "voice",
          { url: up.url, publicId: up.publicId, durationMs: rec.durationMs, bytes: up.bytes },
          "",
          replyTo,
        );
        await notify("message", { toUid: friendUid, body: "🎤 Voice note", data: { messageId } });
      });
    },
    [enqueue, patch, uid, friendUid],
  );

  const retry = useCallback((id: string) => void tasks.current.get(id)?.run(), []);

  // Free object URLs when the screen goes away.
  useEffect(() => {
    const map = previews.current;
    return () => {
      map.forEach((url) => URL.revokeObjectURL(url));
      map.clear();
    };
  }, []);

  return { uploads, sendImages, sendVoice, retry, dismiss: remove };
}
