/**
 * Invites: the pure parts. One helper (`startInvite` in lib/db/invites.ts,
 * bound by hooks/useStartInvite) posts a chat card, drops an in-app toast
 * on the friend's phone and sends the invite push. This module holds the
 * shapes, the wording, the 2-minute cooldown and the card's state, so
 * `pnpm test` can cover them without Firebase.
 */
import type { GameType } from "@/lib/games/types";

/** Everything that can be invited to; also what `InvitePill` and the toasts show. */
export type InviteActivity = GameType | "trivia" | "pictionary" | "twenty" | "wyr" | "nhie" | "tod" | "convo" | "word" | "quiz" | "whiteboard" | "pixel" | "watch" | "listen" | "radio" | "timer" | "cook";

export const INVITE_EMOJI: Record<InviteActivity, string> = {
  tictactoe: "❌",
  connectfour: "🔴",
  chess: "♟️",
  checkers: "⚪",
  dots: "🔲",
  hangman: "🪢",
  battleship: "🚢",
  trivia: "🧠",
  pictionary: "🎨",
  twenty: "🔍",
  wyr: "🤔",
  nhie: "🙊",
  tod: "🎲",
  convo: "💬",
  word: "🟩",
  quiz: "🪞",
  whiteboard: "🖍️",
  pixel: "🟪",
  watch: "📺",
  listen: "🎧",
  radio: "📻",
  timer: "⏱️",
  cook: "🍳",
};

/** How long the chat card's Join button stays live. */
export const INVITE_TTL_MS = 2 * 60 * 60_000;
/** One invite per activity per person inside this window. */
export const INVITE_COOLDOWN_MS = 2 * 60_000;
/** A queued toast older than this on open is dropped (the chat card still shows it). */
export const INVITE_FRESH_MS = 2 * 60_000;
export const INVITE_LABEL_MAX = 80;

/** Stored on the system line: where Join goes and until when. ≤ 5 keys (rule: ≤ 8, exact set checked). */
export type InviteMeta = {
  route: string;
  activity: InviteActivity;
  label: string;
  /** Epoch ms. */
  expiresAt: number;
  /** Game id, trivia / pictionary round id or quiz id, so the card can say "Ended". */
  roundId?: string;
};

/** RTDB invites/{friendUid}/{pushId}: the in-app toast, deleted once shown. */
export interface InviteNode {
  from: string;
  activity: InviteActivity;
  label: string;
  route: string;
  /** Epoch ms (server clock). */
  at: number;
}

export const isInviteActivity = (v: unknown): v is InviteActivity => typeof v === "string" && Object.hasOwn(INVITE_EMOJI, v);

/** Only a same-origin path (never `//host`), ≤ 100 chars; the rules check the same pattern. */
export const isInviteRoute = (v: unknown): v is string => typeof v === "string" && /^\/([A-Za-z0-9_?=&.-][A-Za-z0-9/_?=&.-]{0,98})?$/.test(v);

/** The stored meta if it has the shape; null for anything hand-made or from a future build. */
export function parseInviteMeta(meta: unknown): InviteMeta | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const m = meta as Record<string, unknown>;
  if (!isInviteRoute(m.route) || !isInviteActivity(m.activity) || typeof m.label !== "string" || !m.label.trim() || typeof m.expiresAt !== "number") return null;
  return { route: m.route, activity: m.activity, label: m.label, expiresAt: m.expiresAt, ...(typeof m.roundId === "string" && m.roundId ? { roundId: m.roundId } : {}) };
}

/** The line everyone sees in chat and the push body. */
export const inviteText = (nickname: string, label: string): string => `🎯 ${nickname} started ${label.trim().slice(0, INVITE_LABEL_MAX)}`;

/** What a round looks up as: still open, or finished / declined / taken. */
export type RoundState = "open" | "ended" | "unknown";
export type InviteCardState = "open" | "expired" | "ended";

/** Expiry wins over everything; "ended" needs a round that is known to be over. */
export function inviteCardState(meta: Pick<InviteMeta, "expiresAt">, round: RoundState, now: number): InviteCardState {
  if (now >= meta.expiresAt) return "expired";
  return round === "ended" ? "ended" : "open";
}

/* ── cooldown ──────────────────────────────────────────────────────────── */

/** Last invite per activity, this session (one person, one device: that's what the limit is for). */
const lastSent = new Map<string, number>();

export function inviteCooldownLeft(activity: string, now: number): number {
  const at = lastSent.get(activity);
  return at === undefined ? 0 : Math.max(0, INVITE_COOLDOWN_MS - (now - at));
}
export const inviteAllowed = (activity: string, now: number): boolean => inviteCooldownLeft(activity, now) === 0;
export const markInvited = (activity: string, now: number): void => void lastSent.set(activity, now);
/** Tests only. */
export const resetInviteCooldowns = (): void => lastSent.clear();

/** Route with the auto-join flag that `GameScreen` / `PictionaryGame` honour. */
export const joinRoute = (route: string): string => (route.includes("?") ? `${route}&join=1` : `${route}?join=1`);
