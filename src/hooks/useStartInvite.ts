"use client";

import { useCallback } from "react";

import { useToast } from "@/components/toast/ToastProvider";
import { usePair } from "@/hooks/usePair";
import { startInvite as send, type InviteResult } from "@/lib/db/invites";
import type { InviteActivity } from "@/lib/invites";

export type StartInvite = (activity: InviteActivity, route: string, label: string, extra?: { roundId?: string }) => Promise<InviteResult>;

/**
 * `startInvite(activity, route, label, meta?)` bound to me and my friend.
 * A cooldown hit toasts "Already invited"; a failure toasts once. Returns
 * the result so a button can show "Invited ✓".
 */
export function useStartInvite(): StartInvite {
  const { uid, me, friendUid } = usePair();
  const { toast } = useToast();
  return useCallback<StartInvite>(
    async (activity, route, label, extra) => {
      if (!friendUid) return { ok: false, reason: "failed" };
      const res = await send({ uid, nickname: me.nickname, friendUid }, activity, route, label, extra);
      if (!res.ok && res.reason === "cooldown") toast({ key: "invite", emoji: "✅", title: "Already invited", body: `Give them a minute — you can send another in ${Math.ceil(res.leftMs / 1000)} s`, vibrate: false });
      if (!res.ok && res.reason === "failed") toast({ key: "invite", emoji: "😕", title: "Couldn't send the invite", body: "Check your connection and try again", vibrate: false });
      return res;
    },
    [uid, me.nickname, friendUid, toast],
  );
}
