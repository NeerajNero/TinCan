"use client";

import { Send } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { useNow } from "@/hooks/useNow";
import { usePair } from "@/hooks/usePair";
import { useStartInvite } from "@/hooks/useStartInvite";
import { cn } from "@/lib/cn";
import { inviteCooldownLeft, type InviteActivity } from "@/lib/invites";

/** What a screen's "Share invite" sends: the activity, where Join lands, and the line's object. */
export interface InviteSpec {
  activity: InviteActivity;
  route: string;
  /** Completes "🎯 Sam started …", e.g. "a Trivia duel", "the whiteboard", "cooking Pasta". */
  label: string;
  roundId?: string;
}

/**
 * "Share invite" for a screen header (`SubHeader invite=`), or the compact
 * form inside `FriendHereBadge`. Reads "Invited ✓" while the two-minute
 * cooldown for that activity runs; a tap during it toasts "Already invited".
 */
export function InviteButton({ spec, compact = false, className }: { spec: InviteSpec; compact?: boolean; className?: string }) {
  const { friendUid } = usePair();
  const startInvite = useStartInvite();
  const now = useNow(1000);
  const [busy, setBusy] = useState(false);
  const left = inviteCooldownLeft(spec.activity, now.getTime());
  const invited = left > 0;

  async function send() {
    if (busy || !friendUid) return;
    setBusy(true);
    try {
      await startInvite(spec.activity, spec.route, spec.label, spec.roundId ? { roundId: spec.roundId } : undefined);
    } finally {
      setBusy(false);
    }
  }

  if (compact) {
    return (
      <button type="button" onClick={() => void send()} disabled={!friendUid || busy || invited} className={cn("tap -my-2 rounded-full bg-accent-soft px-2.5 text-[11px] font-bold text-text disabled:opacity-50", className)}>
        {invited ? "Invited ✓" : "Invite"}
      </button>
    );
  }
  return (
    <Button variant="soft" onClick={() => void send()} disabled={!friendUid || busy || invited} aria-label={invited ? "Invite sent" : "Share invite"} className={cn("px-3 py-2 text-sm", className)}>
      {invited ? "Invited ✓" : (
        <>
          <Send size={15} aria-hidden />
          Invite
        </>
      )}
    </Button>
  );
}
