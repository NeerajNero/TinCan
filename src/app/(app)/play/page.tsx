import type { Metadata } from "next";

import { PlayScreen } from "@/components/play/PlayScreen";



export const metadata: Metadata = { title: "Play" };

export default function PlayPage() {
  return <PlayScreen />;
}
