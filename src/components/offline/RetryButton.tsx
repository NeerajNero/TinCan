"use client";

import { Button } from "@/components/ui/Button";

export function RetryButton() {
  return (
    <Button onClick={() => window.location.reload()} className="mt-2">
      Try again
    </Button>
  );
}
