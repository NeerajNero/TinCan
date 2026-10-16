import type { Metadata } from "next";

import { TriviaLobby } from "@/components/play/TriviaScreen";



export const metadata: Metadata = { title: "Trivia duel" };

export default function Page() {
  return <TriviaLobby />;
}
