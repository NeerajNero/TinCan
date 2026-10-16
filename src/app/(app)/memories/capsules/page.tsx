import type { Metadata } from "next";

import { CapsulesScreen } from "@/components/memories/CapsulesScreen";



export const metadata: Metadata = { title: "Time capsules" };

export default function Page() {
  return <CapsulesScreen />;
}
