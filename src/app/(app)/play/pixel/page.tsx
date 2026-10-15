import type { Metadata } from "next";

import { LazyPixel } from "@/components/play/together/lazy";

export const metadata: Metadata = { title: "Pixel art" };

export default function Page() {
  return <LazyPixel />;
}
