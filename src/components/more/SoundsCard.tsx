"use client";

import { useState } from "react";

import { Card } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { playSound, setSoundsEnabled, soundsEnabled } from "@/lib/sounds";

export function SoundsCard() {
  const [on, setOn] = useState(soundsEnabled);
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-xl" aria-hidden>
        🔈
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold leading-tight">Sounds</h2>
        <p className="text-xs text-muted">Tiny blips for pings, sends, wins and stickers. Off by default.</p>
      </div>
      <Switch
        checked={on}
        onChange={(v) => {
          setSoundsEnabled(v);
          setOn(v);
          if (v) playSound("ping");
        }}
        aria-label="Sound effects"
      />
    </Card>
  );
}
