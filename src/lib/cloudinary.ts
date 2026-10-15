/**
 * Cloudinary from the browser: unsigned uploads with progress, and delivery
 * URL transforms. The API secret never comes near this file.
 */
import { publicEnv } from "@/lib/env";

export type UploadKind = "image" | "audio";

export interface UploadResult {
  url: string;
  publicId: string;
  w?: number;
  h?: number;
  bytes: number;
  /** Cloudinary's measured duration for audio, in ms (we prefer the recorder's). */
  durationMs?: number;
}

interface UploadOptions {
  kind: UploadKind;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
  /** Retries once on failure by default. */
  retries?: number;
}

export const cloudinaryConfigured = Boolean(publicEnv.cloudinary.cloudName);

function endpoint(kind: UploadKind) {
  const resource = kind === "audio" ? "video" : "image";
  return `https://api.cloudinary.com/v1_1/${publicEnv.cloudinary.cloudName}/${resource}/upload`;
}

function presetFor(kind: UploadKind) {
  return kind === "audio" ? publicEnv.cloudinary.presetAudio : publicEnv.cloudinary.presetImage;
}

function uploadOnce(blob: Blob, { kind, onProgress, signal }: UploadOptions): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", blob);
    form.append("upload_preset", presetFor(kind));

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onerror = () => reject(new Error("upload_network"));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`upload_${xhr.status}`));
        return;
      }
      try {
        const body = JSON.parse(xhr.responseText) as {
          secure_url: string;
          public_id: string;
          width?: number;
          height?: number;
          bytes: number;
          duration?: number;
        };
        resolve({
          url: body.secure_url,
          publicId: body.public_id,
          w: body.width,
          h: body.height,
          bytes: body.bytes,
          durationMs: typeof body.duration === "number" ? Math.round(body.duration * 1000) : undefined,
        });
      } catch {
        reject(new Error("upload_bad_response"));
      }
    };

    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.open("POST", endpoint(kind));
    xhr.send(form);
  });
}

/** Unsigned upload with progress; retries once on a network/server failure. */
export async function uploadToCloudinary(blob: Blob, options: UploadOptions): Promise<UploadResult> {
  if (!cloudinaryConfigured) throw new Error("cloudinary_not_configured");
  const retries = options.retries ?? 1;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await uploadOnce(blob, options);
    } catch (err) {
      lastError = err;
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      if (options.signal?.aborted) throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("upload_failed");
}

/* ── delivery URLs ─────────────────────────────────────────────────────── */

/** Inserts a transformation right after `/upload/` in a Cloudinary delivery URL. */
export function transformUrl(url: string, transformation: string): string {
  const marker = "/upload/";
  const i = url.indexOf(marker);
  if (i === -1) return url;
  return `${url.slice(0, i + marker.length)}${transformation}/${url.slice(i + marker.length)}`;
}

export const thumbUrl = (url: string) => transformUrl(url, "f_auto,q_auto:low,w_320");
export const fullUrl = (url: string) => transformUrl(url, "f_auto,q_auto:low,w_800");
