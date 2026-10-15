import type { Metadata } from "next";

import { WordleScreen } from "@/components/play/WordleScreen";

export const metadata: Metadata = { title: "Daily word" };

export default function Page() {
  return <WordleScreen />;
}
