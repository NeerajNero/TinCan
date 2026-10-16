/** Only render media from places we expect; anything else gets a placeholder. */
import { publicEnv } from "@/lib/env";

const cloudinaryPrefix = () => `https://res.cloudinary.com/${publicEnv.cloudinary.cloudName}/`;
const GIPHY_RE = /^https:\/\/media\d*\.giphy\.com\//;
const YTIMG_RE = /^https:\/\/(i|i\d)\.ytimg\.com\//;
const GOOGLE_PHOTO_RE = /^https:\/\/lh\d\.googleusercontent\.com\//;

const isCloudinaryUrl = (url: string | null | undefined): url is string => typeof url === "string" && url.startsWith(cloudinaryPrefix());
export const isGiphyUrl = (url: string | null | undefined): url is string => typeof url === "string" && GIPHY_RE.test(url);
const isYouTubeThumb = (url: string | null | undefined): url is string => typeof url === "string" && YTIMG_RE.test(url);
const isGooglePhoto = (url: string | null | undefined): url is string => typeof url === "string" && GOOGLE_PHOTO_RE.test(url);

/** A Cloudinary URL or null. */
export const safeCloudinary = (url: string | null | undefined): string | null => (isCloudinaryUrl(url) ? url : null);
export const safeGif = (url: string | null | undefined): string | null => (isGiphyUrl(url) ? url : null);
export const safeThumb = (url: string | null | undefined): string | null => (isYouTubeThumb(url) ? url : null);
/** Avatars: our Cloudinary or Google's photo CDN. */
export const safeAvatar = (url: string | null | undefined): string | null => (isCloudinaryUrl(url) || isGooglePhoto(url) ? url : null);
