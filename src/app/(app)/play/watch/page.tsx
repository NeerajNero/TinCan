import type { Metadata } from "next";

import { WatchScreen } from "@/components/play/together/WatchScreen";

export const metadata: Metadata = { title: "Watch together" };

export default function Page() {
  return <WatchScreen />;
}
