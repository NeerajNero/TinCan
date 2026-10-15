import type { Metadata } from "next";

import { MapScreen } from "@/components/memories/MapScreen";

export const metadata: Metadata = { title: "Map" };

export default function Page() {
  return <MapScreen />;
}
