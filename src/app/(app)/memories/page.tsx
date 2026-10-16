import type { Metadata } from "next";

import { MemoriesHub } from "@/components/memories/MemoriesHub";



export const metadata: Metadata = { title: "Memories" };

export default function MemoriesPage() {
  return <MemoriesHub />;
}
