
import { BIO_MAX } from "@/components/ui/Avatar";
import { authedFetch } from "@/lib/api";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { pairRef, userRef } from "@/lib/db/refs";
import { deleteField, serverTimestamp, Timestamp, updateDoc } from "@/lib/firebase/fs";
import { compressImage } from "@/lib/media/compress";
import { NOTE_MAX, NOTE_TTL_MS } from "@/lib/notes";
import { swallow } from "@/lib/swallow";
import type { CityPick, HomeCardsPref, PairDoc, UserDoc } from "@/lib/types";
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
    .catch(swallow);
}

/**
 * Compress to a 512 px square-ish JPEG/WebP, upload, point the doc at it, and
 * hand the previous asset to the server for deletion. Progress is 0–1.
 */
export async function uploadAvatar(uid: string, me: UserDoc, file: File, onProgress?: (f: number) => void): Promise<void> {
  const { blob } = await compressImage(file, { maxWidthOrHeight: 512, maxSizeMB: 0.15 });
  const up = await uploadToCloudinary(blob, { kind: "image", purpose: "avatar", onProgress });
  await updateDoc(userRef(uid), {
    avatar: { url: up.url, publicId: up.publicId, variants: up.variants },
    previousAvatarPublicId: me.avatar?.publicId ?? null,
  });
  if (me.avatar?.publicId) await cleanupAvatar();
}

/** Back to the Google photo; the server destroys the asset. */
export async function removeAvatar(uid: string, me: UserDoc): Promise<void> {
  if (!me.avatar) return;
  await updateDoc(userRef(uid), { avatar: null, previousAvatarPublicId: me.avatar.publicId });
  await cleanupAvatar();
  await updateDoc(userRef(uid), { previousAvatarPublicId: deleteField() }).catch(swallow);
}

/* ── Home layout (phase 27) ────────────────────────────────────────────── */

export function setHomeCards(uid: string, pref: HomeCardsPref): Promise<void> {
  return updateDoc(userRef(uid), { homeCards: pref });
}

export function resetHomeCards(uid: string): Promise<void> {
  return updateDoc(userRef(uid), { homeCards: deleteField() });
}

/* ── Notes (phase 27) ──────────────────────────────────────────────────── */

/** Write (or replace) my note; it expires 24 h from now. */
export function setNote(uid: string, text: string, emoji: string | null, now = Date.now()): Promise<void> {
  return updateDoc(userRef(uid), {
    note: { text: text.trim().slice(0, NOTE_MAX), ...(emoji ? { emoji } : {}), at: serverTimestamp(), expiresAt: Timestamp.fromMillis(now + NOTE_TTL_MS) },
  });
}

export function clearNote(uid: string): Promise<void> {
  return updateDoc(userRef(uid), { note: null });
}

/* ── Leftovers of the Home digest card (removed 2026-11-03) ───────────── */

/**
 * The digest card kept `users/{me}.lastOpenAt` and the `pair.jar` / `pair.eventAdded`
 * mirrors; nothing reads them now. Each is deleted once when still present
 * (the rule lets a legacy `lastOpenAt` go but never come back).
 */
export async function clearDigestLeftovers(uid: string, me: UserDoc, pair: PairDoc): Promise<void> {
  if ("lastOpenAt" in me) await updateDoc(userRef(uid), { lastOpenAt: deleteField() });
  const stale = (["jar", "eventAdded"] as const).filter((k) => k in pair);
  if (stale.length) await updateDoc(pairRef(), Object.fromEntries(stale.map((k) => [k, deleteField()])));
}
