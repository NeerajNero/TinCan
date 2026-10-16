import "server-only";

import { v2 as cloudinary } from "cloudinary";

import VARIANTS from "@/lib/media-variants.json";
import type { MediaVariants, VariantPurpose } from "@/lib/types";

/** Configure the SDK from env (server only; the secret never leaves here). */
function configureCloudinary(): typeof cloudinary {
  const cloud_name = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud_name || !api_key || !api_secret) throw new Error("cloudinary_not_configured");
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  return cloudinary;
}

/** Only our own folders can be signed. */
export const PUBLIC_ID_RE = /^tincan\/(images|audio)\/[A-Za-z0-9_-]{1,120}$/;
export const FORMAT_RE = /^[a-z0-9]{2,5}$/;

/**
 * Signed delivery URLs for an `authenticated` asset: one per variant in
 * media-variants.json. Signatures don't expire; each URL grants exactly one
 * transformation of one asset, so knowing it reveals nothing else.
 */
export function signedVariants(publicId: string, purpose: VariantPurpose, format?: string): MediaVariants {
  const sdk = configureCloudinary();
  const table = VARIANTS[purpose] as Record<string, string>;
  const resource_type = purpose === "audio" ? "video" : "image";
  const out: MediaVariants = {};
  for (const [name, transformation] of Object.entries(table)) {
    out[name as keyof MediaVariants] = sdk.url(publicId, {
      type: "authenticated",
      resource_type,
      secure: true,
      sign_url: true,
      ...(transformation ? { raw_transformation: transformation } : {}),
      // The untransformed original keeps its extension so the browser gets the right type.
      ...(!transformation && format ? { format } : {}),
    });
  }
  return out;
}

/** Destroy an asset whichever delivery type it has (authenticated now, upload before the migration). */
export async function destroyAsset(publicId: string, resourceType: "image" | "video"): Promise<void> {
  const sdk = configureCloudinary();
  for (const type of ["authenticated", "upload"] as const) {
    const res = (await sdk.uploader.destroy(publicId, { resource_type: resourceType, type, invalidate: true }).catch(() => ({ result: "error" }))) as { result?: string };
    if (res.result === "ok") return;
  }
}
