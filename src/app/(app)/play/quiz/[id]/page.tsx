import type { Metadata } from "next";

import { QuizDetail } from "@/components/play/QuizScreen";

export const metadata: Metadata = { title: "Know-me quiz" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuizDetail id={id} />;
}
