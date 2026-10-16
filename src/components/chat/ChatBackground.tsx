"use client";

import { CHAT_BG_BY_ID, DEFAULT_CHAT_BG } from "@/content/chat-backgrounds";
import { useTheme } from "@/hooks/useTheme";
import { transformUrl } from "@/lib/cloudinary";
import { safeCloudinary } from "@/lib/safeUrl";
import type { ResolvedTheme } from "@/lib/theme";
import type { ChatBgPref } from "@/lib/types";

/** Cloudinary transform for a photo background: small, low quality, cached for a month by the worker. */
const bgPhotoUrl = (url: string) => transformUrl(url, "f_auto,q_auto:low,w_600");

/** Resolve a preference to inline styles (built-ins) or null (photo / plain). */
export function builtInStyle(pref: ChatBgPref | null | undefined, theme: ResolvedTheme): React.CSSProperties {
  const bg = CHAT_BG_BY_ID[pref?.id ?? DEFAULT_CHAT_BG] ?? CHAT_BG_BY_ID[DEFAULT_CHAT_BG];
  return bg ? bg.style(theme) : {};
}

/**
 * One absolutely positioned layer behind the message list. It never scrolls
 * (so it's never repainted by scrolling) and it's never `background-attachment:
 * fixed`, which Android Chrome paints badly.
 */
export function ChatBackground({ pref }: { pref: ChatBgPref | null | undefined }) {
  const { resolved } = useTheme();
  const photo = pref?.id === "photo" ? safeCloudinary(pref.photoUrl) : null;
  if (photo) {
    return (
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary delivers the transform; Vercel image optimisation is metered */}
        <img src={bgPhotoUrl(photo)} alt="" decoding="async" loading="lazy" className="h-full w-full object-cover" />
        <div className={resolved === "dark" ? "absolute inset-0 bg-[#141a2e]/60" : "absolute inset-0 bg-white/35"} />
      </div>
    );
  }
  return <div aria-hidden className="pointer-events-none absolute inset-0" style={builtInStyle(pref, resolved)} />;
}
