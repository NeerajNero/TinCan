"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { resetHowToSeen } from "@/hooks/useHowToSeen";

/** Brings back the first-visit how-to sheets on this device. */
export function TipsCard() {
  const [done, setDone] = useState(false);
  return (
    <Card className="flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-xl" aria-hidden>
        💡
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold">How-to tips</h2>
        <p className="text-sm text-muted">{done ? "They'll pop up again as you visit each screen." : "Each game shows its tips once. Tap ? any time."}</p>
      </div>
      <Button
        variant="soft"
        onClick={() => {
          resetHowToSeen();
          setDone(true);
        }}
        disabled={done}
        className="shrink-0 px-4 py-2 text-sm"
      >
        {done ? "Done ✓" : "Show all tips again"}
      </Button>
    </Card>
  );
}
