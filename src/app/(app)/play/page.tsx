import type { Metadata } from "next";

import { PlayScreen } from "@/components/play/PlayScreen";
import { TabPaint } from "@/components/shell/TabPaint";

export const metadata: Metadata = { title: "Play" };

export default function PlayPage() {
  return (
    <>
      <TabPaint />
      <PlayScreen />
    </>
  );
}
