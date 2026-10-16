/**
 * Cloudinary from the browser: signed uploads (delivery type `authenticated`)
 * with progress, then one call to /api/media/urls for the signed variant URLs
 * the app renders. The API secret never comes near this file.
 */
import { authedFetch } from "@/lib/api";
import { publicEnv } from "@/lib/env";
import type { MediaVariants, VariantPurpose } from "@/lib/types";

const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const AUDIO_MAX_BYTES = 3 * 1024 * 1024;

interface SignedUpload {
  signature: string;
  apiKey: string;
  cloudName: string;
  params: Record<string, string | number>;
  resourceType: "image" | "video";
}

/** Ask the server for a one-off signature; the param set is fixed there. */
async function sign(kind: UploadKind, bytes: number): Promise<SignedUpload> {
  const res = await authedFetch("/api/media/sign", { method: "POST", body: JSON.stringify({ kind, bytes }) });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error === "too_large" ? `File is over the ${kind === "image" ? "5" : "3"} MB limit` : body.error === "rate_limited" || body.error === "daily_cap" ? "Too many uploads right now — try again in a bit" : "Couldn't prepare the upload");
  }
  return (await res.json()) as SignedUpload;
}

type UploadKind = "image" | "audio";

export interface UploadResult {
  url: string;
  publicId: string;
  w?: number;
  h?: number;
  bytes: number;
  /** Cloudinary's measured duration for audio, in ms (we prefer the recorder's). */
  durationMs?: number;
  /** Signed delivery URLs; store these on the doc and render only them. */
  variants: MediaVariants;
}

interface UploadOptions {
  kind: UploadKind;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
  /** Retries once on failure by default. */
  retries?: number;
  /** Variant table to sign: avatar uploads get a face crop. Defaults from `kind`. */
  purpose?: VariantPurpose;
}

const cloudinaryConfigured = Boolean(publicEnv.cloudinary.cloudName);

type RawUpload = Omit<UploadResult, "variants"> & { format?: string };

function uploadOnce(blob: Blob, signed: SignedUpload, { onProgress, signal }: UploadOptions): Promise<RawUpload> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", blob);
    form.append("api_key", signed.apiKey);
    form.append("signature", signed.signature);
    for (const [k, v] of Object.entries(signed.params)) form.append(k, String(v));

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
          format?: string;
        };
        resolve({
          url: body.secure_url,
          publicId: body.public_id,
          w: body.width,
          h: body.height,
          bytes: body.bytes,
          durationMs: typeof body.duration === "number" ? Math.round(body.duration * 1000) : undefined,
          format: body.format,
        });
      } catch {
        reject(new Error("upload_bad_response"));
      }
    };

    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${signed.cloudName}/${signed.resourceType}/upload`);
    xhr.send(form);
  });
}

/** Signed upload with progress; retries once (with a fresh signature) on a network/server failure. */
export async function uploadToCloudinary(blob: Blob, options: UploadOptions): Promise<UploadResult> {
  if (!cloudinaryConfigured) throw new Error("cloudinary_not_configured");
  const cap = options.kind === "image" ? IMAGE_MAX_BYTES : AUDIO_MAX_BYTES;
  if (blob.size > cap) throw new Error(`File is over the ${options.kind === "image" ? "5" : "3"} MB limit`);
  const retries = options.retries ?? 1;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const signed = await sign(options.kind, blob.size);
      const raw = await uploadOnce(blob, signed, options);
      const { format, ...rest } = raw;
      const variants = await signedUrls(raw.publicId, options.purpose ?? (options.kind === "audio" ? "audio" : "image"), format);
      return { ...rest, variants };
    } catch (err) {
      lastError = err;
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      if (options.signal?.aborted) throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("upload_failed");
}

/** Signed variant URLs for an uploaded asset; one call per upload. */
async function signedUrls(publicId: string, purpose: VariantPurpose, format?: string): Promise<MediaVariants> {
  const res = await authedFetch("/api/media/urls", { method: "POST", body: JSON.stringify({ publicId, purpose, ...(format && /^[a-z0-9]{2,5}$/.test(format) ? { format } : {}) }) });
  if (!res.ok) throw new Error("Couldn't finish the upload");
  return ((await res.json()) as { variants: MediaVariants }).variants;
}

/* ── delivery URLs (legacy public assets only; see lib/mediaUrl.ts) ──────── */

/** Inserts a transformation right after `/upload/` in a Cloudinary delivery URL. */
export function transformUrl(url: string, transformation: string): string {
  const marker = "/upload/";
  const i = url.indexOf(marker);
  if (i === -1) return url;
  return `${url.slice(0, i + marker.length)}${transformation}/${url.slice(i + marker.length)}`;
}

