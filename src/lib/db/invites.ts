/**
 * One invite = a chat card + an in-app toast on the friend's phone + the
 * invite push. Called through `hooks/useStartInvite` (which binds the
 * sender) by every game and together activity.
 */
import { createSystemMessage } from "@/lib/chat/system";
import { getDb, getRtdb } from "@/lib/firebase/client";
import { doc, getDoc } from "@/lib/firebase/fs";
import { get, push, ref, serverTimestamp, set } from "@/lib/firebase/rt";
import { INVITE_LABEL_MAX, INVITE_TTL_MS, inviteAllowed, inviteCooldownLeft, inviteText, markInvited, type InviteActivity, type InviteMeta, type RoundState } from "@/lib/invites";
import { notify } from "@/lib/notify";
import { swallow } from "@/lib/swallow";

export interface InviteSender {
  uid: string;
  nickname: string;
  friendUid: string;
}

export type InviteResult = { ok: true; messageId: string | null } | { ok: false; reason: "cooldown"; leftMs: number } | { ok: false; reason: "failed" };

export const invitesPath = (uid: string) => `invites/${uid}`;

/**
 * Post the card, queue the toast, send the push. Rate-limited to one per
 * activity per two minutes per person; the chat card is the step that must
 * succeed, the other two are fire-and-forget.
 */
export async function startInvite(sender: InviteSender, activity: InviteActivity, route: string, label: string, extra: { roundId?: string } = {}): Promise<InviteResult> {
  const now = Date.now();
  if (!inviteAllowed(activity, now)) return { ok: false, reason: "cooldown", leftMs: inviteCooldownLeft(activity, now) };
  const text = inviteText(sender.nickname, label);
  const meta: InviteMeta = { route, activity, label: label.trim().slice(0, INVITE_LABEL_MAX), expiresAt: now + INVITE_TTL_MS, ...(extra.roundId ? { roundId: extra.roundId } : {}) };
  let messageId: string | null;
  try {
    messageId = await createSystemMessage("invite", text, meta);
  } catch {
    return { ok: false, reason: "failed" };
  }
  markInvited(activity, now);
  set(push(ref(getRtdb(), invitesPath(sender.friendUid))), { from: sender.uid, activity, label: meta.label, route, at: serverTimestamp() }).catch(swallow);
  void notify("invite", { toUid: sender.friendUid, body: `started ${meta.label} — join? ${activity === "cook" ? "🍳" : "🎯"}`, data: { url: route } });
  return { ok: true, messageId };
}

/* ── is the round still open? (for the card's "Ended") ─────────────────── */

const roundStates = new Map<string, Promise<RoundState>>();

/**
 * One lookup per round id per session: RTDB for board games and Pictionary
 * (gone or closed = ended), Firestore for trivia (both scores in) and quizzes
 * (taken). Anything else has no round and stays "open" until it expires.
 */
export function fetchRoundState(activity: InviteActivity, roundId: string): Promise<RoundState> {
  const key = `${activity}:${roundId}`;
  let p = roundStates.get(key);
  if (!p) {
    p = lookup(activity, roundId).catch((): RoundState => "unknown");
    roundStates.set(key, p);
  }
  return p;
}

async function lookup(activity: InviteActivity, roundId: string): Promise<RoundState> {
  switch (activity) {
    case "tictactoe":
    case "connectfour":
    case "chess":
    case "checkers": {
      const snap = await get(ref(getRtdb(), `games/${roundId}`));
      const status = (snap.val() as { status?: string } | null)?.status;
      return !status || status === "finished" || status === "declined" ? "ended" : "open";
    }
    case "pictionary": {
      const snap = await get(ref(getRtdb(), `pictionary/${roundId}`));
      const status = (snap.val() as { status?: string } | null)?.status;
      return !status || status === "finished" || status === "declined" ? "ended" : "open";
    }
    case "trivia": {
      const snap = await getDoc(doc(getDb(), "trivia", roundId));
      const d = snap.data() as { finishedAt?: unknown; answers?: Record<string, unknown> } | undefined;
      return !d || d.finishedAt || Object.keys(d.answers ?? {}).length >= 2 ? "ended" : "open";
    }
    case "quiz": {
      const snap = await getDoc(doc(getDb(), "quizzes", roundId));
      const d = snap.data() as { takenBy?: Record<string, unknown> } | undefined;
      return !d || Object.keys(d.takenBy ?? {}).length > 0 ? "ended" : "open";
    }
    default:
      return "open";
  }
}
