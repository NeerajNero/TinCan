import type { Metadata } from "next";

import { PlanScreen } from "@/components/plan/PlanScreen";

export const metadata: Metadata = { title: "Plan" };

export default function PlanPage() {
  return <PlanScreen />;
}
