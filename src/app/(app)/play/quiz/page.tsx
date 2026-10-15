import type { Metadata } from "next";

import { QuizList } from "@/components/play/QuizScreen";

export const metadata: Metadata = { title: "Know-me quiz" };

export default function Page() {
  return <QuizList />;
}
