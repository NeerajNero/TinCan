import Image from "next/image";

import { cn } from "@/lib/cn";
import { transformUrl } from "@/lib/cloudinary";
import { safeAvatar, safeCloudinary } from "@/lib/safeUrl";
import type { UserDoc } from "@/lib/types";

export const BIO_MAX = 120;

/** Best available picture: the custom avatar (face-cropped by Cloudinary) else the Google photo. */
export function avatarUrl(user: Pick<UserDoc, "photoURL" | "avatar">, px = 160): string | null {
  const custom = safeCloudinary(user.avatar?.url);
  if (custom) return transformUrl(custom, `f_auto,q_auto,c_fill,g_face,w_${px},h_${px}`);
  return safeAvatar(user.photoURL);
}

interface AvatarProps {
  user: Pick<UserDoc, "photoURL" | "avatar">;
  /** CSS pixels. */
  size: number;
  className?: string;
}

export function Avatar({ user, size, className }: AvatarProps) {
  const src = avatarUrl(user, size * 2);
  if (!src) {
    return (
      <div className={cn("grid shrink-0 place-items-center rounded-full bg-accent-soft", className)} style={{ width: size, height: size, fontSize: size * 0.5 }} aria-hidden>
        🙂
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      unoptimized
      referrerPolicy="no-referrer"
      className={cn("shrink-0 rounded-full bg-surface-2 object-cover", className)}
      style={{ width: size, height: size }}
    />
  );
}
