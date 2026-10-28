import type { Metadata } from "next";

import { PlanScreen } from "@/components/plan/PlanScreen";
import { TabPaint } from "@/components/shell/TabPaint";

export const metadata: Metadata = { title: "Plan" };

export default function PlanPage() {
  return (
    <>
      <TabPaint />
      <PlanScreen />
    </>
  );
}
