import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ListScreen } from "@/components/plan/ListScreen";
import { LIST_KINDS, type ListKind } from "@/lib/types";


export const metadata: Metadata = { title: "Lists" };

export function generateStaticParams() {
  return LIST_KINDS.map((kind) => ({ kind }));
}

export default async function Page({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!LIST_KINDS.includes(kind as ListKind)) notFound();
  return <ListScreen kind={kind as ListKind} />;
}
