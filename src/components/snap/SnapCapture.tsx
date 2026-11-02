"use client";

import { Camera, Images, RefreshCw, SwitchCamera } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useToast } from "@/components/toast/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { postSnap } from "@/lib/db/snaps";
import { haptic } from "@/lib/haptics";
import { compressImage } from "@/lib/media/compress";
import { SNAP_CAPTION_MAX, snapTiming } from "@/lib/snap";
import { errorMessage } from "@/lib/swallow";
import type { SnapEntryDoc } from "@/lib/types";

interface SnapCaptureProps {
  today: string;
  uid: string;
  friendName: string;
  friendPosted: boolean;
  /** Posting before this (ms) is `onTime`; null = always `later` (the Home card after the prompt). */
  deadline: number | null;
  onPosted: (entry: SnapEntryDoc) => void;
  /** Try to open the camera as soon as this mounts (browsers may insist on a tap; the button is the fallback). */
  autoOpen?: boolean;
}

/**
 * Camera-first capture shared by the Home takeover and /snap: back camera,
 * "Flip to selfie", gallery; preview with Retake, a 60-char caption and Post.
 * The friend's snap stays a blurred placeholder here (never fetched).
 */
export function SnapCapture({ today, uid, friendName, friendPosted, deadline, onPosted, autoOpen = true }: SnapCaptureProps) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [file, setFile] = useState<File | null>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const [caption, setCaption] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!autoOpen) return;
    const t = setTimeout(() => cameraInput.current?.click(), 150);
    return () => clearTimeout(t);
  }, [autoOpen]);
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  function pick(list: FileList | null) {
    const f = list?.[0];
    if (f && f.type.startsWith("image/")) setFile(f);
    if (cameraInput.current) cameraInput.current.value = "";
    if (galleryInput.current) galleryInput.current.value = "";
  }

  function flip() {
    setFacing((f) => (f === "environment" ? "user" : "environment"));
    setFile(null);
    setTimeout(() => cameraInput.current?.click(), 0);
  }

  async function post() {
    if (!file || progress !== null) return;
    setError(null);
    setProgress(0);
    try {
      const { blob, w, h } = await compressImage(file);
      const up = await uploadToCloudinary(blob, { kind: "image", folder: "snaps", onProgress: setProgress });
      const timing = snapTiming(deadline, Date.now());
      const entry = await postSnap(uid, today, { url: up.url, publicId: up.publicId, variants: up.variants, w: up.w ?? w, h: up.h ?? h }, caption, timing);
      haptic("success");
      toast({ key: "snap", emoji: "📸", title: timing.onTime ? "Snap posted!" : "Posted (a little later)", body: friendPosted ? `${friendName}'s is unlocked` : `Now waiting for ${friendName}`, vibrate: false });
      onPosted(entry);
    } catch (err) {
      haptic("error");
      setError(errorMessage(err, "Couldn't post the snap. Try again?"));
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input ref={cameraInput} type="file" accept="image/*" capture={facing} hidden onChange={(e) => pick(e.target.files)} />
      <input ref={galleryInput} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files)} />

      {preview ? (
        <Card className="flex flex-col gap-3 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
          <img src={preview} alt="Your snap" className="max-h-[50dvh] w-full rounded-2xl bg-surface-2 object-contain" />
          <Input value={caption} onChange={(e) => setCaption(e.target.value.slice(0, SNAP_CAPTION_MAX))} placeholder="Caption (optional)" aria-label="Caption" maxLength={SNAP_CAPTION_MAX} />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" onClick={() => setFile(null)} disabled={progress !== null} className="px-4 py-2 text-sm">
              <RefreshCw size={16} aria-hidden />
              Retake
            </Button>
            <Button onClick={() => void post()} disabled={progress !== null} className="px-6">
              {progress !== null ? `Posting ${Math.round(progress * 100)}%` : "Post"}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="flex flex-col items-center gap-3 py-6 text-center">
          <Button onClick={() => cameraInput.current?.click()} className="px-8 py-4 text-lg">
            <Camera size={22} aria-hidden />
            Open camera
          </Button>
          <div className="flex gap-2">
            <Button variant="soft" onClick={flip} className="px-4 py-2 text-sm">
              <SwitchCamera size={16} aria-hidden />
              {facing === "environment" ? "Flip to selfie" : "Back camera"}
            </Button>
            <Button variant="soft" onClick={() => galleryInput.current?.click()} className="px-4 py-2 text-sm">
              <Images size={16} aria-hidden />
              Choose from gallery
            </Button>
          </div>
        </Card>
      )}

      <Card className="flex items-center gap-3 py-3">
        <BlurredSnap />
        <p className="min-w-0 flex-1 text-sm text-muted">{friendPosted ? `${friendName} has posted · post yours to see it` : `${friendName} hasn't posted yet`}</p>
      </Card>
    </div>
  );
}

export function BlurredSnap() {
  return (
    <span className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-surface-2" aria-hidden>
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,var(--accent),transparent_60%),radial-gradient(circle_at_70%_70%,var(--accent-soft),transparent_60%)] opacity-70 blur-md" />
      <span className="relative text-2xl">👀</span>
    </span>
  );
}
