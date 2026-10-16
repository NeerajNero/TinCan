"use client";

import { useState } from "react";

import { builtInStyle } from "@/components/chat/ChatBackground";
import { ChatBackgroundPicker } from "@/components/chat/ChatBackgroundPicker";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CHAT_BG_BY_ID } from "@/content/chat-backgrounds";
import { usePair } from "@/hooks/usePair";
import { useTheme } from "@/hooks/useTheme";
import { thumbUrl } from "@/lib/cloudinary";
import { safeCloudinary } from "@/lib/safeUrl";

export function ChatBackgroundCard() {
  const { uid, me } = usePair();
  const { resolved } = useTheme();
  const [open, setOpen] = useState(false);
  const pref = me.chatBg ?? null;
  const photo = pref?.id === "photo" ? safeCloudinary(pref.photoUrl) : null;
  const builtIn = pref?.id !== "photo" ? CHAT_BG_BY_ID[pref?.id ?? "plain"] : null;

  return (
    <Card className="flex items-center gap-3">
      <span className="relative block size-14 shrink-0 overflow-hidden rounded-xl border border-border" style={builtIn ? builtInStyle(pref, resolved) : undefined} aria-hidden>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element -- Cloudinary thumbnail
          <img src={thumbUrl(photo)} alt="" decoding="async" loading="lazy" className="h-full w-full object-cover" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold">Chat background</h2>
        <p className="truncate text-sm text-muted">{photo ? "📷 A photo from Memories" : `${builtIn?.emoji ?? "⬜"} ${builtIn?.name ?? "Plain"}`}</p>
      </div>
      <Button variant="soft" onClick={() => setOpen(true)} className="shrink-0 px-4 py-2 text-sm">
        Change
      </Button>
      <ChatBackgroundPicker open={open} uid={uid} current={pref} onClose={() => setOpen(false)} />
    </Card>
  );
}
