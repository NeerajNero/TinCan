"use client";

import { TabError } from "@/components/ui/TabError";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <TabError reset={reset} emoji="🏠" />;
}
