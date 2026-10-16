/**
 * The one place that turns a stored media object into a URL to render.
 *
 * Assets are delivered as Cloudinary type `authenticated`, so the app can't
 * build transformation URLs itself: it renders the signed variants stored on
 * the doc at upload time (`variants`). Assets still on public delivery
 * (`/upload/`, from before scripts/migrate-media-authenticated.mjs ran) fall
 * back to a client-side transform. Anything else renders nothing.
 */
import { transformUrl } from "@/lib/cloudinary";
import VARIANTS from "@/lib/media-variants.json";
import { safeCloudinary } from "@/lib/safeUrl";
import type { MediaVariants } from "@/lib/types";

export type Variant = keyof MediaVariants;

export interface MediaLike {
  url?: string | null;
  variants?: MediaVariants | null;
}

const TRANSFORMS: Record<Variant, string> = { ...VARIANTS.image, ...VARIANTS.avatar, ...VARIANTS.audio };

const isPublicDelivery = (url: string) => /\/(image|video)\/upload\//.test(url);

export function variantUrl(media: MediaLike | null | undefined, variant: Variant): string | null {
  const stored = safeCloudinary(media?.variants?.[variant]);
  if (stored) return stored;
  const url = safeCloudinary(media?.url);
  if (!url || !isPublicDelivery(url)) return null;
  const t = TRANSFORMS[variant];
  return t ? transformUrl(url, t) : url;
}

/**
 * The chat background photo: chatBg.photoUrl holds the memory's signed w640
 * variant (or, before the migration, a public original we can still transform).
 */
export const chatBgPhotoUrl = (photoUrl: string | null | undefined): string | null => variantUrl({ url: photoUrl, variants: { w640: photoUrl ?? undefined } }, "w640");

/** True when the object points at one of our assets at all (for "unavailable" placeholders). */
export const hasMedia = (media: MediaLike | null | undefined) => Boolean(safeCloudinary(media?.url) || safeCloudinary(media?.variants?.original));
