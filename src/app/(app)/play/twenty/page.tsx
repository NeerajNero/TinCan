import type { Metadata } from "next";

import { TwentyScreen } from "@/components/play/TwentyScreen";

export const metadata: Metadata = { title: "20 Questions" };

export default function Page() {
  return <TwentyScreen />;
}
