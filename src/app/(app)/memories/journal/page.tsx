import type { Metadata } from "next";

import { JournalScreen } from "@/components/memories/JournalScreen";

export const metadata: Metadata = { title: "Journal" };

export default function Page() {
  return <JournalScreen />;
}
