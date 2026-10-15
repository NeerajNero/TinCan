"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/** Shown by each tab's error boundary. */
export function TabError({ reset, emoji = "🧵", title = "That got tangled" }: { reset: () => void; emoji?: string; title?: string }) {
  return (
    <Card className="flex flex-col items-center gap-3 py-10 text-center">
      <span className="text-5xl" aria-hidden>
        {emoji}
      </span>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="max-w-xs text-sm text-muted">Something in this tab tripped over itself. Nothing was lost.</p>
      <Button onClick={reset} className="px-6">
        Try again
      </Button>
    </Card>
  );
}
