import type { Metadata } from "next";

import { GardenScreen } from "@/components/memories/GardenScreen";

export const metadata: Metadata = { title: "Garden" };

export default function Page() {
  return <GardenScreen />;
}
