import type { Metadata } from "next";

import { CallsScreen } from "@/components/plan/CallsScreen";

export const metadata: Metadata = { title: "Call-time finder" };

export default function Page() {
  return <CallsScreen />;
}
