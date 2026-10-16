import type { Metadata } from "next";

import { PictionaryLobby } from "@/components/play/together/PictionaryScreen";



export const metadata: Metadata = { title: "Pictionary" };

export default function Page() {
  return <PictionaryLobby />;
}
