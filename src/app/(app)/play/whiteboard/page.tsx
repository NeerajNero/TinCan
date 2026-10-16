import type { Metadata } from "next";

import { LazyWhiteboard } from "@/components/play/together/lazy";



export const metadata: Metadata = { title: "Whiteboard" };

export default function Page() {
  return <LazyWhiteboard />;
}
