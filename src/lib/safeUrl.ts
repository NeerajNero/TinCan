/** Only render media from places we expect; anything else gets a placeholder. */
import { publicEnv } from "@/lib/env";

const cloudinaryPrefix = () => `https://res.cloudinary.com/${publicEnv.cloudinary.cloudName}/`;
const GIPHY_RE = /^https:\/\/media\d*\.giphy\.com\//;
const YTIMG_RE = /^https:\/\/(i|i\d)\.ytimg\.com\//;
const GOOGLE_PHOTO_RE = /^https:\/\/lh\d\.googleusercontent\.com\//;

/**
 * Our cloud's delivery URLs: public (`/upload/`, legacy) or authenticated with
 * a signature (`/authenticated/s--xxxxxxxx--/`), for images and audio (video type).
 */
const deliveryRe = () => new RegExp(`^${cloudinaryPrefix().replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}(image|video)/(upload/|authenticated/s--[A-Za-z0-9_-]{8}--/)`);
const isCloudinaryUrl = (url: string | null | undefined): url is string => typeof url === "string" && deliveryRe().test(url);
export const isGiphyUrl = (url: string | null | undefined): url is string => typeof url === "string" && GIPHY_RE.test(url);
const isYouTubeThumb = (url: string | null | undefined): url is string => typeof url === "string" && YTIMG_RE.test(url);
const isGooglePhoto = (url: string | null | undefined): url is string => typeof url === "string" && GOOGLE_PHOTO_RE.test(url);

/** A Cloudinary URL or null. */
export const safeCloudinary = (url: string | null | undefined): string | null => (isCloudinaryUrl(url) ? url : null);
export const safeGif = (url: string | null | undefined): string | null => (isGiphyUrl(url) ? url : null);
export const safeThumb = (url: string | null | undefined): string | null => (isYouTubeThumb(url) ? url : null);
/** Avatars: our Cloudinary or Google's photo CDN. */
export const safeAvatar = (url: string | null | undefined): string | null => (isCloudinaryUrl(url) || isGooglePhoto(url) ? url : null);

/** A user-typed link (lists): only http(s), so `javascript:` and friends never become an href. */
export function safeHttpUrl(url: string | null | undefined): string | null {
  if (typeof url !== "string") return null;
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}
