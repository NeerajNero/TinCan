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

export interface PairDoc {
  /** The two friends. Length 1 until the second one signs in. */
  uids: string[];
  /** Shared day boundary for daily things. */
  roomTz: string;
  friendsSince: DateKey | null;
  nextMeetup: NextMeetup | null;
  createdAt: Timestamp | null;
  // pet, plant, garden, streak and theme are added by later phases.
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
