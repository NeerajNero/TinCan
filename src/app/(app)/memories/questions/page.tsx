import type { Metadata } from "next";

import { QuestionsHistory } from "@/components/memories/QuestionsHistory";



export const metadata: Metadata = { title: "Daily questions" };

export default function Page() {
  return <QuestionsHistory />;
}
