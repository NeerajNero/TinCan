import type { Timestamp } from "firebase/firestore";

/* ── Notifications ─────────────────────────────────────────────────────── */

/** Every push type a user can toggle in More → Notifications. */
export const NOTIF_KEYS = [
  "message",
  "ping",
  "lamp",
  "yourTurn",
  "dailyQuestion",
  "jar",
  "capsule",
  "scheduled",
  "petHungry",
  "streak",
  "milestone",
  "meetup",
  "invite",
] as const;

export type NotifKey = (typeof NOTIF_KEYS)[number];
export type NotifPrefs = Record<NotifKey, boolean>;

/** All on by default. */
export function defaultNotifPrefs(): NotifPrefs {
  return Object.fromEntries(NOTIF_KEYS.map((k) => [k, true])) as NotifPrefs;
}

/* ── users/{uid} ───────────────────────────────────────────────────────── */

export interface UserDoc {
  /** Google display name. */
  name: string;
  /** What the friend sees everywhere. */
  nickname: string;
  email: string;
  photoURL: string | null;
  /** IANA zone, e.g. "Asia/Kolkata". */
  tz: string;
  city: string;
  lat: number;
  lng: number;
  fcmTokens: string[];
  notif: NotifPrefs;
  createdAt: Timestamp | null;
}

/* ── pair/main ─────────────────────────────────────────────────────────── */

/** A calendar date with no time, always `yyyy-MM-dd`. */
export type DateKey = string;

export interface NextMeetup {
  date: DateKey;
  label: string;
  place: string;
}

export interface Streak {
  /** Consecutive room-days on which both friends opened the app. */
  count: number;
  /** The last room-day counted. */
  lastDateKey: DateKey;
}

export interface Plant {
  /** 1–10; only ever goes up. */
  stage: number;
  lastGrowthDate: DateKey;
}

export interface PairDoc {
  /** The two friends. Length 1 until the second one signs in. */
  uids: string[];
  /** Shared day boundary for daily things. */
  roomTz: string;
  friendsSince: DateKey | null;
  nextMeetup: NextMeetup | null;
  streak?: Streak;
  plant?: Plant;
  createdAt: Timestamp | null;
  // pet, garden and theme are added by later phases.
}

/* ── moods/{dateKey}_{uid} ─────────────────────────────────────────────── */

export const MOOD_EMOJI = ["😊", "🥳", "😍", "😐", "😴", "😢", "😤", "🤒"] as const;
export type MoodEmoji = (typeof MOOD_EMOJI)[number];

export interface MoodDoc {
  emoji: string;
  note: string;
  at: Timestamp | null;
}

/* ── messages/{id} (only what phase 3 writes; chat fills this in) ─────── */

export type MessageType = "text" | "image" | "voice" | "gif" | "sticker" | "system";
export type MessageStatus = "sent" | "delivered" | "read";

export interface ReplyTo {
  id: string;
  preview: string;
  senderId: string;
  type: MessageType;
}

/**
 * image: url, publicId, w, h, bytes · voice: url, publicId, durationMs, bytes
 * gif: url, w, h · sticker: stickerId
 */
export interface MessageMedia {
  url?: string;
  publicId?: string;
  w?: number;
  h?: number;
  durationMs?: number;
  bytes?: number;
  stickerId?: string;
}

export interface MessageDoc {
  senderId: string;
  type: MessageType;
  text: string;
  media?: MessageMedia | null;
  replyTo?: ReplyTo | null;
  /** uid → emoji */
  reactions: Record<string, string>;
  status: MessageStatus;
  deliveredAt: Timestamp | null;
  readAt: Timestamp | null;
  editedAt?: Timestamp | null;
  deletedFor: string[];
  deletedForEveryone: boolean;
  createdAt: Timestamp | null;
}

/** A message as the chat renders it. */
export interface Message extends MessageDoc {
  id: string;
  /** Local write not yet acknowledged by the server (also the offline queue). */
  pending: boolean;
  /** Server time, or the SDK's estimate while pending. */
  createdAtMs: number;
}

/* ── RTDB ──────────────────────────────────────────────────────────────── */

export type PresenceStatus = "awake" | "sleeping";

export interface PresenceNode {
  online: boolean;
  /** Epoch ms (RTDB serverTimestamp). */
  lastSeen: number;
  status?: PresenceStatus;
  page?: string;
}

export const PING_KINDS = ["thinking", "hug", "highfive", "wave"] as const;
export type PingKind = (typeof PING_KINDS)[number];

export const PINGS: Record<PingKind, { emoji: string; label: string; sentence: string }> = {
  thinking: { emoji: "💭", label: "Thinking of you", sentence: "is thinking of you" },
  hug: { emoji: "🤗", label: "Hug", sentence: "sent you a hug" },
  highfive: { emoji: "✋", label: "High-five", sentence: "high-fived you" },
  wave: { emoji: "👋", label: "Wave", sentence: "waved at you" },
};

export interface PingNode {
  from: string;
  kind: PingKind;
  at: number;
}

export const LAMP_COLORS = [
  { id: "amber", hex: "#ffb454", label: "Amber" },
  { id: "pink", hex: "#ff8fab", label: "Pink" },
  { id: "sky", hex: "#6fb6ff", label: "Sky" },
  { id: "mint", hex: "#5fd3a4", label: "Mint" },
  { id: "lilac", hex: "#b48cff", label: "Lilac" },
  { id: "coral", hex: "#ff6b6b", label: "Coral" },
] as const;

export interface LampNode {
  on: boolean;
  color: string;
  /** Epoch ms after which the lamp is dark again. */
  until: number;
}

/* ── Places (Open-Meteo geocoding) ─────────────────────────────────────── */

export interface CityPick {
  city: string;
  /** Country / region for display, e.g. "Maharashtra, India". */
  region: string;
  lat: number;
  lng: number;
  tz: string;
}
