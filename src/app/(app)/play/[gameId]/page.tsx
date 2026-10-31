import type { Metadata } from "next";

import { BoardGameScreen } from "@/components/play/BoardGameScreen";



export const metadata: Metadata = { title: "Game" };

export default async function Page({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  return <BoardGameScreen gameId={gameId} />;
}
