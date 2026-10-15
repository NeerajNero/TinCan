import type { Metadata } from "next";

import { Placeholder } from "@/components/placeholder/Placeholder";

export const metadata: Metadata = { title: "Memories" };

export default function MemoriesPage() {
  return (
    <Placeholder
      emoji="📸"
      title="Memories"
      blurb="Photos, places, milestones, the journal and letters to the future."
      phase={7}
    />
  );
}
