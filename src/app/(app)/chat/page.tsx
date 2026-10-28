import type { Metadata } from "next";

import { ChatScreen } from "@/components/chat/ChatScreen";
import { TabPaint } from "@/components/shell/TabPaint";

export const metadata: Metadata = { title: "Chat" };

export default function ChatPage() {
  return (
    <>
      <TabPaint />
      <ChatScreen />
    </>
  );
}
