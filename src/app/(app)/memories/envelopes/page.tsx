import type { Metadata } from "next";

import { EnvelopesScreen } from "@/components/memories/EnvelopesScreen";



export const metadata: Metadata = { title: "Open when" };

export default function Page() {
  return <EnvelopesScreen />;
}
