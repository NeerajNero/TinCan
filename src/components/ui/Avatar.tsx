
import { cn } from "@/lib/cn";
import { variantUrl } from "@/lib/mediaUrl";
import { safeAvatar } from "@/lib/safeUrl";
import type { UserDoc } from "@/lib/types";

export const BIO_MAX = 120;

/** Best available picture: the custom avatar's signed 256 px face crop, else the Google photo. */
function avatarUrl(user: Pick<UserDoc, "photoURL" | "avatar">): string | null {
  return variantUrl(user.avatar, "face") ?? safeAvatar(user.photoURL);
}

interface AvatarProps {
  user: Pick<UserDoc, "photoURL" | "avatar">;
  /** CSS pixels. */
  size: number;
  className?: string;
}

export function Avatar({ user, size, className }: AvatarProps) {
  const src = avatarUrl(user);
  if (!src) {
    return (
      <div className={cn("grid shrink-0 place-items-center rounded-full bg-accent-soft", className)} style={{ width: size, height: size, fontSize: size * 0.5 }} aria-hidden>
        🙂
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Cloudinary/Google deliver the exact size; Vercel image optimisation is metered
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      decoding="async"
      loading="lazy"
      referrerPolicy="no-referrer"
      className={cn("shrink-0 rounded-full bg-surface-2 object-cover", className)}
      style={{ width: size, height: size }}
    />
  );
}
