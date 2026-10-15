import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isAllowedEmail } from "@/lib/allowlist";
import { adminDb, AuthError, verifyBearer } from "@/lib/firebase/admin";

const bodySchema = z.object({ messageId: z.string().min(1).max(128) });

function configureCloudinary() {
  const cloud_name = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud_name || !api_key || !api_secret) throw new Error("cloudinary_not_configured");
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
}

/**
 * DELETE /api/media — "delete for everyone" on an image or voice message.
 * Only the uploader may call it. Destroys the Cloudinary asset, then clears
 * the message's media and marks it deleted (admin write, bypasses rules).
 */
export async function DELETE(req: Request) {
  try {
    const token = await verifyBearer(req);
    if (!isAllowedEmail(token.email) || token.email_verified === false) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

    const ref = adminDb().collection("messages").doc(parsed.data.messageId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const data = snap.data() as { senderId?: string; type?: string; media?: { publicId?: string } | null };
    if (data.senderId !== token.uid) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const publicId = data.media?.publicId;
    if (publicId && (data.type === "image" || data.type === "voice")) {
      configureCloudinary();
      await cloudinary.uploader.destroy(publicId, {
        resource_type: data.type === "voice" ? "video" : "image",
        invalidate: true,
      });
    }

    await ref.update({ media: null, text: "", deletedForEveryone: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[api/media]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
