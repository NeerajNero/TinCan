"use client";

import { HelpCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { HOWTO, type HowToKey } from "@/content/howto";
import { markHowToSeen, useHowToSeen } from "@/hooks/useHowToSeen";
import { cn } from "@/lib/cn";

/** The how-to content on the shared Sheet. */
function HowToSheet({ topic, open, onClose }: { topic: HowToKey; open: boolean; onClose: () => void }) {
  const h = HOWTO[topic];
  return (
    <Sheet open={open} onClose={onClose} label={`How ${h.title} works`} className="flex flex-col gap-3 px-5">
      <h2 className="font-heading text-xl font-semibold">How {h.title} works</h2>
      <ul className="flex flex-col gap-2">
        {h.steps.map((step) => (
          <li key={step} className="text-[15px] leading-snug">
            {step}
          </li>
        ))}
      </ul>
      {h.tip && <p className="rounded-2xl bg-accent-soft px-3 py-2 text-sm">💡 {h.tip}</p>}
      <Button onClick={onClose} className="mt-1 self-end px-6">
        Got it
      </Button>
    </Sheet>
  );
}

/**
 * The small ? button plus its sheet. With `autoOpen` (screen headers) the
 * sheet opens by itself the first time the screen is visited on this device;
 * cards on Home/Memories pass `autoOpen={false}` so Home never stacks sheets.
 */
export function HowToButton({ topic, autoOpen = true, className }: { topic: HowToKey; autoOpen?: boolean; className?: string }) {
  const seen = useHowToSeen(topic);
  const [asked, setAsked] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  // Derived, not stored: the first visit shows it until "Got it" marks it seen.
  const open = asked || (autoOpen && seen === false && !dismissed);
  function close() {
    markHowToSeen(topic);
    setAsked(false);
    setDismissed(true);
  }
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setAsked(true);
        }}
        aria-label={`How ${HOWTO[topic].title} works`}
        className={cn("tap grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2", className)}
      >
        <HelpCircle size={20} />
      </button>
      <HowToSheet topic={topic} open={open} onClose={close} />
    </>
  );
}
