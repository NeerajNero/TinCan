import type { Metadata } from "next";

import { Placeholder } from "@/components/placeholder/Placeholder";

export const metadata: Metadata = { title: "Chat" };

export default function ChatPage() {
  return (
    <Placeholder
      emoji="💬"
      title="Chat"
      blurb="One thread, just the two of you — texts, photos, voice notes and stickers."
      phase={4}
    />
  );
}
