import type { Metadata } from "next";

import { GameScreen } from "@/components/play/GameScreen";

export const metadata: Metadata = { title: "Game" };

export default async function Page({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  return <GameScreen gameId={gameId} />;
}
