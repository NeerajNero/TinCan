import type { Metadata } from "next";

import { RadioScreen } from "@/components/play/together/RadioScreen";

export const metadata: Metadata = { title: "Radio" };

export default function Page() {
  return <RadioScreen />;
}
