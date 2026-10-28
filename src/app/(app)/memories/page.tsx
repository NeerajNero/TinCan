import type { Metadata } from "next";

import { MemoriesHub } from "@/components/memories/MemoriesHub";
import { TabPaint } from "@/components/shell/TabPaint";

export const metadata: Metadata = { title: "Memories" };

export default function MemoriesPage() {
  return (
    <>
      <TabPaint />
      <MemoriesHub />
    </>
  );
}
