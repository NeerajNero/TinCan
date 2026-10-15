import type { Metadata } from "next";

import { WhiteboardScreen } from "@/components/play/together/WhiteboardScreen";

export const metadata: Metadata = { title: "Whiteboard" };

export default function Page() {
  return <WhiteboardScreen />;
}
