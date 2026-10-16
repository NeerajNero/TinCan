/**
 * A plain <img> for Cloudinary assets. next/image is deliberately not used
 * with remote sources: Vercel Hobby meters image optimisation, and Cloudinary
 * already resizes on the fly. Thumbnails get a 320/640 srcset (so 2× screens
 * pick the sharper one), a 40 px blurred placeholder inside the aspect box,
 * and async decoding; the full-screen viewer passes `eager`.
 */
import { transformUrl } from "@/lib/cloudinary";
import { cn } from "@/lib/cn";

const BLUR = "e_blur:2000,q_1,w_40";

interface CloudImageProps {
  /** A verified Cloudinary delivery URL (run it through safeCloudinary first). */
  url: string;
  alt: string;
  /** Intrinsic size from the upload, for the aspect box. */
  w?: number;
  h?: number;
  /** How wide the image is laid out, for the browser's srcset choice. Default: the thumbnail widths. */
  sizes?: string;
  /** Thumbnails (default) use 320/640; "full" uses 800/1600 and loads eagerly. */
  variant?: "thumb" | "full";
  className?: string;
  style?: React.CSSProperties;
  draggable?: boolean;
}

export function CloudImage({ url, alt, w, h, sizes = "240px", variant = "thumb", className, style, draggable }: CloudImageProps) {
  const widths = variant === "full" ? [800, 1600] : [320, 640];
  const srcSet = widths.map((px) => `${transformUrl(url, `f_auto,q_auto:low,w_${px}`)} ${px}w`).join(", ");
  const aspect = w && h ? `${w} / ${h}` : undefined;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- see the note above
    <img
      src={transformUrl(url, `f_auto,q_auto:low,w_${widths[0]}`)}
      srcSet={srcSet}
      sizes={variant === "full" ? "100vw" : sizes}
      alt={alt}
      width={w}
      height={h}
      decoding="async"
      loading={variant === "full" ? "eager" : "lazy"}
      draggable={draggable}
      className={cn("bg-surface-2 bg-cover bg-center", className)}
      style={{ aspectRatio: aspect, backgroundImage: `url("${transformUrl(url, BLUR)}")`, ...style }}
    />
  );
}
