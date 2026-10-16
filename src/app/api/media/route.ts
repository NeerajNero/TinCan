import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";
import { z } from "zod";

import { adminDb } from "@/lib/firebase/admin";
import { errorResponse, guard, readJson } from "@/lib/server/guard";
import { swallow } from "@/lib/swallow";
const bodySchema = z.union([
  z.object({ kind: z.enum(["message", "memory", "journal", "capsule"]), id: z.string().min(1).max(128) }).strict(),
  // Destroy the caller's stale avatar asset (previousAvatarPublicId on their own user doc).
  z.object({ kind: z.literal("avatar") }).strict(),
  // Back-compat with the phase 5 client.
  z.object({ messageId: z.string().min(1).max(128) }).strict(),
]);

function configureCloudinary() {
  const cloud_name = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud_name || !api_key || !api_secret) throw new Error("cloudinary_not_configured");
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
}

async function destroyAll(ids: string[], resourceType: "image" | "video" = "image") {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return 0;
  configureCloudinary();
  await Promise.all(unique.map((id) => cloudinary.uploader.destroy(id, { resource_type: resourceType, invalidate: true }).catch(swallow)));
  return unique.length;
}

/** True when a chat asset was also saved to memories, so a message delete must leave it alone. */
async function sharedByMemory(publicId: string): Promise<boolean> {
  const snap = await adminDb().collection("memories").where("publicId", "==", publicId).where("sharedAsset", "==", true).limit(1).get();
  return !snap.empty;
}

type Media = { publicId?: string } | null | undefined;
type MediaList = Array<{ publicId?: string }> | undefined;

/**
 * DELETE /api/media — owner-only removal of a message's media, a memory, a
 * journal entry or a (still-locked) capsule, destroying their Cloudinary
 * assets first. Admin writes bypass rules; ownership is checked here.
 */
export async function DELETE(req: Request) {
  try {
    const { uid } = await guard(req, "media");
    const body = await readJson(req, bodySchema);
    const db = adminDb();

    if ("kind" in body && body.kind === "avatar") {
      const userRef = db.doc(`users/${uid}`);
      const stale = ((await userRef.get()).data()?.previousAvatarPublicId as string | null | undefined) ?? null;
      if (stale) {
        await destroyAll([stale]);
        await userRef.update({ previousAvatarPublicId: null });
      }
      return NextResponse.json({ ok: true, destroyed: stale ? 1 : 0 });
    }

    const kind = "kind" in body ? body.kind : "message";
    const id = "kind" in body ? body.id : body.messageId;

    if (kind === "message") {
      const ref = db.collection("messages").doc(id);
      const snap = await ref.get();
      if (!snap.exists) return NextResponse.json({ error: "not_found" }, { status: 404 });
      const data = snap.data() as { senderId?: string; type?: string; media?: Media };
      if (data.senderId !== uid) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      const publicId = data.media?.publicId;
      let destroyed = 0;
      if (publicId && (data.type === "image" || data.type === "voice") && !(await sharedByMemory(publicId))) {
        destroyed = await destroyAll([publicId], data.type === "voice" ? "video" : "image");
      }
      await ref.update({ media: null, text: "", deletedForEveryone: true });
      return NextResponse.json({ ok: true, destroyed });
    }

    if (kind === "memory") {
      const ref = db.collection("memories").doc(id);
      const snap = await ref.get();
      if (!snap.exists) return NextResponse.json({ error: "not_found" }, { status: 404 });
      const data = snap.data() as { uploaderId?: string; publicId?: string; sharedAsset?: boolean };
      if (data.uploaderId !== uid) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      const destroyed = data.sharedAsset ? 0 : await destroyAll([data.publicId ?? ""]);
      await ref.delete();
      return NextResponse.json({ ok: true, destroyed });
    }

    if (kind === "journal") {
      const ref = db.collection("journal").doc(id);
      const snap = await ref.get();
      if (!snap.exists) return NextResponse.json({ error: "not_found" }, { status: 404 });
      const data = snap.data() as { authorId?: string; media?: MediaList };
      if (data.authorId !== uid) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      const destroyed = await destroyAll((data.media ?? []).map((m) => m.publicId ?? ""));
      await ref.delete();
      return NextResponse.json({ ok: true, destroyed });
    }

    // capsule: author-only, and only while still locked
    const ref = db.collection("capsules").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const data = snap.data() as { authorId?: string; unlockAt?: { toMillis(): number } };
    if (data.authorId !== uid) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    if ((data.unlockAt?.toMillis() ?? 0) <= Date.now()) return NextResponse.json({ error: "already_unlocked" }, { status: 409 });
    const bodyRef = ref.collection("private").doc("body");
    const bodyData = (await bodyRef.get()).data() as { media?: MediaList } | undefined;
    const destroyed = await destroyAll((bodyData?.media ?? []).map((m) => m.publicId ?? ""));
    await bodyRef.delete();
    await ref.delete();
    return NextResponse.json({ ok: true, destroyed });
  } catch (err) {
    return errorResponse(err, "media");
  }
}
