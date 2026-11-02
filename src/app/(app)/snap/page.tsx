import type { Metadata } from "next";

import { SnapScreen } from "@/components/snap/SnapScreen";

export const metadata: Metadata = { title: "Daily snap" };

export default function Page() {
  return <SnapScreen />;
}
