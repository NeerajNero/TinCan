import { NextResponse } from "next/server";
import { z } from "zod";

import { FORMAT_RE, PUBLIC_ID_RE, signedVariants } from "@/lib/server/cloudinary";
import { errorResponse, guard, readJson } from "@/lib/server/guard";

const bodySchema = z
  .object({
    publicId: z.string().regex(PUBLIC_ID_RE),
    purpose: z.enum(["image", "avatar", "audio"]),
    format: z.string().regex(FORMAT_RE).optional(),
  })
  .strict();

/**
 * POST /api/media/urls — signed delivery URLs for one just-uploaded
 * authenticated asset, for the fixed variant set (media-variants.json).
 * Called once per upload; the client stores the result on the doc and only
 * ever renders stored URLs.
 */
export async function POST(req: Request) {
  try {
    await guard(req, "urls");
    const { publicId, purpose, format } = await readJson(req, bodySchema);
    if (purpose === "audio" ? !publicId.startsWith("tincan/audio/") : !publicId.startsWith("tincan/images/")) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    return NextResponse.json({ variants: signedVariants(publicId, purpose, format) });
  } catch (err) {
    return errorResponse(err, "urls");
  }
}
