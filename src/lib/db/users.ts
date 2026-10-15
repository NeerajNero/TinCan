import { deleteField, updateDoc } from "firebase/firestore";

import { BIO_MAX } from "@/components/ui/Avatar";
import { authedFetch } from "@/lib/api";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { userRef } from "@/lib/db/refs";
import { compressImage } from "@/lib/media/compress";
import type { CityPick, UserDoc } from "@/lib/types";

export function setNickname(uid: string, nickname: string): Promise<void> {
  return updateDoc(userRef(uid), { nickname: nickname.trim() });
}

export function setBio(uid: string, bio: string): Promise<void> {
  return updateDoc(userRef(uid), { bio: bio.trim().slice(0, BIO_MAX) });
}

export function setCity(uid: string, place: CityPick): Promise<void> {
  return updateDoc(userRef(uid), {
    city: place.city,
    lat: place.lat,
    lng: place.lng,
    tz: place.tz,
  });
}

/** Ask the server to destroy whatever avatar asset the user doc says is stale. */
function cleanupAvatar(): Promise<void> {
  return authedFetch("/api/media", { method: "DELETE", body: JSON.stringify({ kind: "avatar" }) })
    .then(() => undefined)
    .catch(() => undefined);
}

/**
 * Compress to a 512 px square-ish JPEG/WebP, upload, point the doc at it, and
 * hand the previous asset to the server for deletion. Progress is 0–1.
 */
export async function uploadAvatar(uid: string, me: UserDoc, file: File, onProgress?: (f: number) => void): Promise<void> {
  const { blob } = await compressImage(file, { maxWidthOrHeight: 512, maxSizeMB: 0.15 });
  const up = await uploadToCloudinary(blob, { kind: "image", onProgress });
  await updateDoc(userRef(uid), {
    avatar: { url: up.url, publicId: up.publicId },
    previousAvatarPublicId: me.avatar?.publicId ?? null,
  });
  if (me.avatar?.publicId) await cleanupAvatar();
}

/** Back to the Google photo; the server destroys the asset. */
export async function removeAvatar(uid: string, me: UserDoc): Promise<void> {
  if (!me.avatar) return;
  await updateDoc(userRef(uid), { avatar: null, previousAvatarPublicId: me.avatar.publicId });
  await cleanupAvatar();
  await updateDoc(userRef(uid), { previousAvatarPublicId: deleteField() }).catch(() => undefined);
}
