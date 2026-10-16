import type { Metadata } from "next";

import { TimerScreen } from "@/components/play/together/TimerScreen";



export const metadata: Metadata = { title: "Focus timer" };

export default function Page() {
  return <TimerScreen />;
}
