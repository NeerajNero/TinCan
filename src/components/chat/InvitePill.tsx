"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { SystemPill } from "@/components/chat/SystemPill";
import { useNow } from "@/hooks/useNow";
import { fetchRoundState } from "@/lib/db/invites";
import { INVITE_EMOJI, inviteCardState, joinRoute, parseInviteMeta, type RoundState } from "@/lib/invites";
import type { Message } from "@/lib/types";

/**
 * A system line of kind `invite`: the text plus a Join button that opens the
 * activity (with the auto-join flag). After `expiresAt` the button reads
 * "Expired"; once the round it points at is over, "Ended" (one lookup per
 * round per session). A card whose meta doesn't parse renders as a plain pill.
 */
export function InvitePill({ message }: { message: Pick<Message, "text" | "kind" | "meta" | "senderId"> }) {
  const meta = parseInviteMeta(message.meta);
  const router = useRouter();
  const now = useNow(30_000);
  const [round, setRound] = useState<RoundState>("unknown");
  const expired = meta ? now.getTime() >= meta.expiresAt : true;
  const roundId = meta?.roundId ?? null;
  const activity = meta?.activity ?? null;

  useEffect(() => {
    if (!roundId || !activity || expired) return;
    let live = true;
    void fetchRoundState(activity, roundId).then((s) => live && setRound(s));
    return () => {
      live = false;
    };
  }, [roundId, activity, expired]);

  if (!meta) return <SystemPill message={message} />;
  const state = inviteCardState(meta, round, now.getTime());
  return (
    <div role="note" className="relative mx-auto flex max-w-[92%] items-center gap-2 rounded-[18px] bg-surface px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.08)]">
      <span className="text-xl" aria-hidden>
        {INVITE_EMOJI[meta.activity]}
      </span>
      <span className="min-w-0 flex-1 text-xs font-semibold text-muted">{message.text?.trim() || `🎯 An invite to ${meta.label}`}</span>
      {state === "open" ? (
        <button type="button" onClick={() => router.push(joinRoute(meta.route))} className="tap min-h-9 shrink-0 rounded-full bg-accent px-3.5 text-xs font-bold text-accent-ink">
          Join
        </button>
      ) : (
        <span className="shrink-0 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-bold text-muted">{state === "expired" ? "Expired" : "Ended"}</span>
      )}
    </div>
  );
}
