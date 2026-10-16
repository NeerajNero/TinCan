import type { Metadata } from "next";

import { PetScreen } from "@/components/pet/PetScreen";



export const metadata: Metadata = { title: "Pet" };

export default function Page() {
  return <PetScreen />;
}
