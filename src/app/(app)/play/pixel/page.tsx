import type { Metadata } from "next";

import { PixelScreen } from "@/components/play/together/PixelScreen";

export const metadata: Metadata = { title: "Pixel art" };

export default function Page() {
  return <PixelScreen />;
}
