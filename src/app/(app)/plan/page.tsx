import type { Metadata } from "next";

import { Placeholder } from "@/components/placeholder/Placeholder";

export const metadata: Metadata = { title: "Plan" };

export default function PlanPage() {
  return (
    <Placeholder
      emoji="🗓️"
      title="Plan"
      blurb="Next meetup, call times, shared lists and trips."
      phase={8}
    />
  );
}
