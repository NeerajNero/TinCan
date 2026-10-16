import type { Metadata } from "next";

import { CookList } from "@/components/play/together/CookScreen";



export const metadata: Metadata = { title: "Cook-along" };

export default function Page() {
  return <CookList />;
}
