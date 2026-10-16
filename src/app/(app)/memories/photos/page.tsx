import type { Metadata } from "next";

import { PhotosScreen } from "@/components/memories/PhotosScreen";



export const metadata: Metadata = { title: "Photos" };

export default function Page() {
  return <PhotosScreen />;
}
