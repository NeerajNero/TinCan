import type { Metadata } from "next";

import { WheelScreen } from "@/components/play/WheelScreen";



export const metadata: Metadata = { title: "Hangout wheel" };

export default function Page() {
  return <WheelScreen />;
}
