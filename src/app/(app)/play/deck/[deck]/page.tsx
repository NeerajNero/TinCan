import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DeckScreen } from "@/components/play/DeckScreen";
import { DECK_KINDS, type DeckKind } from "@/lib/deckMeta";


export const metadata: Metadata = { title: "Deck" };

export function generateStaticParams() {
  return DECK_KINDS.map((deck) => ({ deck }));
}

export default async function Page({ params }: { params: Promise<{ deck: string }> }) {
  const { deck } = await params;
  if (!DECK_KINDS.includes(deck as DeckKind)) notFound();
  return <DeckScreen kind={deck as DeckKind} />;
}
