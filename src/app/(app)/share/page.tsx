import type { Metadata } from "next";

import { ShareScreen } from "@/components/share/ShareScreen";

export const metadata: Metadata = { title: "Share" };

export default function SharePage() {
  return <ShareScreen />;
}
