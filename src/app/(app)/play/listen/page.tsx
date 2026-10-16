import type { Metadata } from "next";

import { ListenScreen } from "@/components/play/together/ListenScreen";



export const metadata: Metadata = { title: "Listen together" };

export default function Page() {
  return <ListenScreen />;
}
