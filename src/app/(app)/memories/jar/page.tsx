import type { Metadata } from "next";

import { JarScreen } from "@/components/memories/JarScreen";



export const metadata: Metadata = { title: "Jar" };

export default function Page() {
  return <JarScreen />;
}
