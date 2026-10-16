/**
 * A plain <img> for our Cloudinary assets. next/image is deliberately not used
 * with remote sources (Vercel Hobby meters image optimisation). Assets are
 * private (authenticated delivery), so the URLs come from the signed variants
 * stored on the doc: thumbnails use a 320/640 srcset, the viewer the 800 px
 * variant, and a 40 px blurred variant fills the aspect box while loading.
 */
import { cn } from "@/lib/cn";
import { variantUrl, type MediaLike } from "@/lib/mediaUrl";

interface CloudImageProps {
  media: MediaLike;
  alt: string;
  /** Intrinsic size from the upload, for the aspect box. */
  w?: number;
  h?: number;
  /** Layout width hint for the srcset choice. */
  sizes?: string;
  /** Thumbnails (default) use 320/640; "full" is the 800 px viewer variant, loaded eagerly. */
  variant?: "thumb" | "full";
  className?: string;
  style?: React.CSSProperties;
  draggable?: boolean;
}

export function CloudImage({ media, alt, w, h, sizes = "240px", variant = "thumb", className, style, draggable }: CloudImageProps) {
  const full = variant === "full";
  const src = full ? variantUrl(media, "w800") : variantUrl(media, "w320");
  if (!src) return <span className={cn("grid place-items-center bg-surface-2 text-xs text-muted", className)}>🚫</span>;
  const w640 = full ? null : variantUrl(media, "w640");
  const blur = variantUrl(media, "blur");
  const aspect = w && h ? `${w} / ${h}` : undefined;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- see the note above
    <img
      src={src}
      srcSet={w640 ? `${src} 320w, ${w640} 640w` : undefined}
      sizes={w640 ? sizes : undefined}
      alt={alt}
      width={w}
      height={h}
      decoding="async"
      loading={full ? "eager" : "lazy"}
      draggable={draggable}
      className={cn("bg-surface-2 bg-cover bg-center", className)}
      style={{ aspectRatio: aspect, backgroundImage: blur ? `url("${blur}")` : undefined, ...style }}
    />
  );
}
