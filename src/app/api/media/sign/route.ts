import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse, guard, GuardError, readJson } from "@/lib/server/guard";

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const AUDIO_MAX_BYTES = 3 * 1024 * 1024;

const bodySchema = z.object({ kind: z.enum(["image", "audio"]), bytes: z.number().int().positive() }).strict();

/**
 * POST /api/media/sign — a short-lived signature for one upload with a fixed
 * parameter set. The client must send exactly these params; Cloudinary
 * rejects anything else. Presets stay named but must be switched to Signed.
 */
export async function POST(req: Request) {
  try {
    await guard(req, "sign");
    const { kind, bytes } = await readJson(req, bodySchema);
    const cap = kind === "image" ? IMAGE_MAX_BYTES : AUDIO_MAX_BYTES;
    if (bytes > cap) throw new GuardError(413, "too_large");

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) throw new GuardError(500, "server_error", "cloudinary env missing");

    const timestamp = Math.floor(Date.now() / 1000);
    const params: Record<string, string | number> = {
      timestamp,
      folder: kind === "image" ? "tincan/images" : "tincan/audio",
      upload_preset: kind === "image" ? (process.env.NEXT_PUBLIC_CLOUDINARY_PRESET_IMAGE ?? "tincan_image") : (process.env.NEXT_PUBLIC_CLOUDINARY_PRESET_AUDIO ?? "tincan_audio"),
      ...(kind === "image" ? { transformation: "c_limit,w_1080,h_1080,q_auto:low" } : {}),
    };
    const signature = cloudinary.utils.api_sign_request(params, apiSecret);
    return NextResponse.json({ signature, apiKey, cloudName, params, resourceType: kind === "image" ? "image" : "video" });
  } catch (err) {
    return errorResponse(err, "sign");
  }
}
