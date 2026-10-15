import type { Metadata } from "next";

import { TriviaRound } from "@/components/play/TriviaScreen";

export const metadata: Metadata = { title: "Trivia duel" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TriviaRound id={id} />;
}
