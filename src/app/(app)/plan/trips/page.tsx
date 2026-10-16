import type { Metadata } from "next";

import { TripsScreen } from "@/components/plan/TripsScreen";



export const metadata: Metadata = { title: "Trips" };

export default function Page() {
  return <TripsScreen />;
}
