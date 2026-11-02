import type { Metadata } from "next";

import { UpcomingScreen } from "@/components/plan/UpcomingScreen";

export const metadata: Metadata = { title: "Upcoming" };

export default function Page() {
  return <UpcomingScreen />;
}
