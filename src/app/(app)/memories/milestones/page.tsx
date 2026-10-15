import type { Metadata } from "next";

import { MilestonesScreen } from "@/components/memories/MilestonesScreen";

export const metadata: Metadata = { title: "Milestones" };

export default function Page() {
  return <MilestonesScreen />;
}
