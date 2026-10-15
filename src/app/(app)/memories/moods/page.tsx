import type { Metadata } from "next";

import { MoodsScreen } from "@/components/memories/MoodsScreen";

export const metadata: Metadata = { title: "Moods" };

export default function Page() {
  return <MoodsScreen />;
}
