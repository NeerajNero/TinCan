import type { Metadata } from "next";

import { SnapsScreen } from "@/components/memories/SnapsScreen";

export const metadata: Metadata = { title: "Snaps" };

export default function Page() {
  return <SnapsScreen />;
}
