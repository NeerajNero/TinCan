import type { Metadata } from "next";

import { MoreScreen } from "@/components/more/MoreScreen";
import { TabPaint } from "@/components/shell/TabPaint";

export const metadata: Metadata = { title: "More" };

export default function MorePage() {
  return (
    <>
      <TabPaint />
      <MoreScreen />
    </>
  );
}
