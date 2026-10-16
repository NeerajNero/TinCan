import type { Metadata } from "next";

import { PictionaryGame } from "@/components/play/together/PictionaryScreen";



export const metadata: Metadata = { title: "Pictionary" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PictionaryGame id={id} />;
}
