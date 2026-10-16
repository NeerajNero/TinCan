import type { Timestamp } from "@/lib/firebase/fs";

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
  "envelopeOpened",
] as const;

export type NotifKey = (typeof NOTIF_KEYS)[number];

/** Per-type toggles plus the master switch. `enabled` stays false until the user opts in. */
export type NotifPrefs = Record<NotifKey, boolean> & { enabled: boolean };

/** Every type on, master off. */
export function defaultNotifPrefs(): NotifPrefs {
  return { ...(Object.fromEntries(NOTIF_KEYS.map((k) => [k, true])) as Record<NotifKey, boolean>), enabled: false };
}

export const NOTIF_LABELS: Record<NotifKey, string> = {
  message: "New messages",
  ping: "Pings (hugs, waves…)",
  lamp: "Lamp lit",
  yourTurn: "Your turn in a game",
  dailyQuestion: "Friend answered the daily question",
  jar: "New jar note",
  capsule: "Time capsule unlocked",
  scheduled: "Scheduled messages",
  petHungry: "Pet is hungry",
  streak: "Streak at risk",
  milestone: "Milestones",
  meetup: "Meetup countdown (7 and 1 day)",
  invite: "Game invites",
  envelopeOpened: "Friend opened your envelope",
};

/* ── users/{uid} ───────────────────────────────────────────────────────── */

export interface ChatBgPref {
  id: string;
  photoUrl?: string | null;
  photoPublicId?: string | null;
}

export interface UserDoc {
  /** Google display name. */
  name: string;
  /** What the friend sees everywhere. */
  nickname: string;
  email: string;
  /** Google photo, the fallback when no custom avatar is set. */
  photoURL: string | null;
  /** Custom photo uploaded to Cloudinary; null/absent means use photoURL. */
  avatar?: { url: string; publicId: string } | null;
  /** Destroyed by the server after a replacement; see /api/media. */
  previousAvatarPublicId?: string | null;
  /** One short line about me (≤120 chars). */
  bio?: string;
  /** IANA zone, e.g. "Asia/Kolkata". */
  tz: string;
  city: string;
  lat: number;
  lng: number;
  fcmTokens: string[];
  notif: NotifPrefs;
  /** Days the daily word was solved (bumped client-side). */
  wordleSolved?: number;
  /** Chat background: a built-in id, or "photo" with a memory's Cloudinary URL. Absent means plain. */
  chatBg?: ChatBgPref | null;
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
  /** Compact mirror of the milestones collection so Home needs no extra listener. */
  milestonesSummary?: MilestoneSummary[];
  /** Upcoming trips mirrored from the trips collection (countdown fallback, no extra listener). */
  tripsSummary?: TripSummary[];
  /** Preset id from src/content/relationships.ts; absent means "friends". */
  relationship?: string;
  /** Head-to-head per game: { [uid]: wins, draws }. */
  records?: Record<string, Record<string, number>>;
  /** Completed focus sessions per room day. */
  focusSessions?: Record<string, number>;
  pet?: PetDoc;
  /** Unlocked garden stickers: id → when/why. */
  garden?: { stickers?: Record<string, GardenUnlock> };
  /** Small shared counters for threshold unlocks. */
  counters?: { pings?: number };
  createdAt: Timestamp | null;
  // pet, garden and theme are added by later phases.
}

export interface MilestoneSummary {
  id: string;
  title: string;
  emoji: string;
  date: DateKey;
  repeatYearly: boolean;
}

/* ── moods/{dateKey}_{uid} ─────────────────────────────────────────────── */

export const MOOD_EMOJI = ["😊", "🥳", "😍", "😐", "😴", "😢", "😤", "🤒"] as const;

export interface MoodDoc {
  emoji: string;
  note: string;
  at: Timestamp | null;
  /** Written from phase 7 on; older docs lack these and simply don't show in history. */
  dateKey?: DateKey;
  uid?: string;
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

/** The four everyday pings plus the relationship extra ("kiss"), shown only when the preset has it. */
export type PingKind = "thinking" | "hug" | "highfive" | "wave" | "kiss";
export const BASE_PING_KINDS: readonly PingKind[] = ["thinking", "hug", "highfive", "wave"];

export const PINGS: Record<PingKind, { emoji: string; label: string; sentence: string }> = {
  thinking: { emoji: "💭", label: "Thinking of you", sentence: "is thinking of you" },
  hug: { emoji: "🤗", label: "Hug", sentence: "sent you a hug" },
  highfive: { emoji: "✋", label: "High-five", sentence: "high-fived you" },
  wave: { emoji: "👋", label: "Wave", sentence: "waved at you" },
  kiss: { emoji: "😘", label: "Kiss", sentence: "blew you a kiss" },
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

/* ── shared media item (journal, capsules) ─────────────────────────────── */

export interface MediaItem {
  url: string;
  publicId: string;
  w: number;
  h: number;
}

/* ── dailyQuestions/{dateKey} ──────────────────────────────────────────── */

interface DailyAnswer {
  text: string;
  at: Timestamp | null;
}

export interface DailyQuestionDoc {
  questionIndex: number;
  answers: Record<string, DailyAnswer>;
  /** Equals the doc id; lets history order by date with an automatic index. */
  dateKey?: DateKey;
}

/* ── journal/{id} ──────────────────────────────────────────────────────── */

export interface JournalDoc {
  authorId: string;
  text: string;
  mood: string;
  media: MediaItem[];
  createdAt: Timestamp | null;
  editedAt?: Timestamp | null;
}

/* ── capsules/{id} (+ private/body) ────────────────────────────────────── */

export interface CapsuleDoc {
  authorId: string;
  title: string;
  unlockAt: Timestamp;
  openedAt: Timestamp | null;
  openedBy: string | null;
  photoCount: number;
  createdAt: Timestamp | null;
}

export interface CapsuleBody {
  body: string;
  media: MediaItem[];
}

/* ── envelopes/{id} (+ private/body) ───────────────────────────────────── */

export const ENVELOPE_LABELS = ["sad", "bored", "miss me", "can't sleep", "need a laugh", "proud of you"] as const;

export interface EnvelopeDoc {
  authorId: string;
  forUid: string;
  label: string;
  openedAt: Timestamp | null;
  createdAt: Timestamp | null;
}

export interface EnvelopeBody {
  body: string;
}

/* ── jar/{id} ──────────────────────────────────────────────────────────── */

export interface JarDoc {
  authorId: string;
  forUid: string;
  text: string;
  drawnAt: Timestamp | null;
  createdAt: Timestamp | null;
}

/* ── scheduled/{id} ────────────────────────────────────────────────────── */

export interface ScheduledDoc {
  senderId: string;
  text: string;
  sendAt: Timestamp;
  sentAt: Timestamp | null;
  messageId: string | null;
  createdAt: Timestamp | null;
}

/* ── milestones/{id} (phase 7 UI; the tick job reads this shape) ───────── */

export interface MilestoneDoc {
  title: string;
  /** yyyy-MM-dd */
  date: DateKey;
  repeatYearly: boolean;
  emoji: string;
  createdAt?: Timestamp | null;
}

/* ── memories/{id} ─────────────────────────────────────────────────────── */

export interface MemoryDoc {
  uploaderId: string;
  url: string;
  publicId: string;
  w: number;
  h: number;
  caption: string;
  takenAt: Timestamp;
  placeId: string | null;
  /** The asset also belongs to a chat message; deleting the memory must not destroy it. */
  sharedAsset?: boolean;
  createdAt: Timestamp | null;
}

/* ── places/{id} ───────────────────────────────────────────────────────── */

export type PlaceKind = "been" | "want";

export interface PlaceDoc {
  name: string;
  lat: number;
  lng: number;
  kind: PlaceKind;
  note: string;
  visitedAt: DateKey | null;
  addedBy: string;
  createdAt: Timestamp | null;
}

/* ── availability/{uid} ────────────────────────────────────────────────── */

export const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export interface AvailabilityDoc {
  /** "HH:mm" half-hour slot starts, in the owner's own tz. */
  slots: Partial<Record<WeekdayKey, string[]>>;
  tz: string;
  updatedAt: Timestamp | null;
}

/* ── lists/{kind}/items/{id} ───────────────────────────────────────────── */

export const LIST_KINDS = ["bucket", "wishlist", "gifts", "todo"] as const;
export type ListKind = (typeof LIST_KINDS)[number];

export interface ListItemDoc {
  text: string;
  note: string;
  url: string;
  addedBy: string;
  done: boolean;
  doneAt: Timestamp | null;
  order: number;
  createdAt: Timestamp | null;
}

/* ── trips/{id} ────────────────────────────────────────────────────────── */

export interface TripStop {
  id: string;
  time: string;
  name: string;
  note: string;
}

export interface TripDay {
  date: DateKey;
  stops: TripStop[];
}

export interface TripDoc {
  title: string;
  place: string;
  startDate: DateKey;
  endDate: DateKey;
  days: TripDay[];
  createdAt: Timestamp | null;
}

export interface TripSummary {
  id: string;
  title: string;
  place: string;
  startDate: DateKey;
  endDate: DateKey;
}

/* ── pet (on pair/main) ────────────────────────────────────────────────── */

export type PetSpecies = "blob" | "sprout" | "puff";
export type PetMood = "happy" | "hungry" | "sad" | "sleeping";

export interface PetDoc {
  name: string;
  species: PetSpecies;
  /** Epoch ms of the last feed / play / tuck-in. */
  hungerAt: number;
  happyAt: number;
  sleepAt: number;
  /** Stored so a level-up can be noticed and announced once. */
  level: number;
  bornAt: number;
}

interface GardenUnlock {
  at: Timestamp | null;
  by: string;
}
