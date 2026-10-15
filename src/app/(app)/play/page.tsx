import type { Metadata } from "next";

import { Placeholder } from "@/components/placeholder/Placeholder";

export const metadata: Metadata = { title: "Play" };

export default function PlayPage() {
  return (
    <Placeholder
      emoji="🎲"
      title="Play"
      blurb="Games to win and things to do together, live."
      phase={9}
    />
  );
}
