import type { Metadata } from "next";

import { CookDetail } from "@/components/play/together/CookScreen";



export const metadata: Metadata = { title: "Cook-along" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CookDetail id={id} />;
}
