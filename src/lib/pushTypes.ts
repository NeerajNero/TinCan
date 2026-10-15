/**
 * Every push the app can send, which More → Notifications toggle governs it,
 * and what the notification says. Shared by /api/push, /api/tick and the
 * client's notify(). Later phases add rows here.
 */
import type { NotifKey } from "@/lib/types";

export const PUSH_TYPES = [
  "message",
  "ping",
  "lamp",
  "test",
  "daily-answer",
  "daily-nudge",
  "streak-risk",
  "capsule-unlocked",
  "envelope-opened",
  "jar",
  "scheduled",
  "milestone",
  "meetup",
  "yourTurn",
  "invite",
  "petHungry",
] as const;
export type PushType = (typeof PUSH_TYPES)[number];

/** Which per-type toggle applies; null = only the master switch. */
export const TOGGLE_FOR: Record<PushType, NotifKey | null> = {
  message: "message",
  ping: "ping",
  lamp: "lamp",
  test: null,
  "daily-answer": "dailyQuestion",
  "daily-nudge": "dailyQuestion",
  "streak-risk": "streak",
  "capsule-unlocked": "capsule",
  "envelope-opened": "envelopeOpened",
  jar: "jar",
  scheduled: "scheduled",
  milestone: "milestone",
  meetup: "meetup",
  yourTurn: "yourTurn",
  invite: "invite",
  petHungry: "petHungry",
};

export interface PushPayload {
  title?: string;
  body?: string;
  data?: Record<string, string>;
}

export interface PushNote {
  title: string;
  body: string;
  url: string;
  tag: string;
}

const PING_LINES: Record<string, string> = {
  thinking: "💭 is thinking of you",
  hug: "🤗 sent you a hug",
  highfive: "✋ high-fived you",
  wave: "👋 waved at you",
  kiss: "😘 blew you a kiss",
};

/** Title/body/url per type. `senderName` is the other person's nickname. */
export function composePush(type: PushType, senderName: string, payload: PushPayload = {}): PushNote {
  const d = payload.data ?? {};
  const body = payload.body ?? "";
  switch (type) {
    case "message":
      return { title: senderName, body: (body || "New message").slice(0, 140), url: "/chat", tag: "message" };
    case "ping":
      return { title: senderName, body: PING_LINES[d.kind ?? ""] ?? "sent you a ping", url: "/", tag: "ping" };
    case "lamp":
      return { title: senderName, body: "💡 lit your lamp", url: "/", tag: "lamp" };
    case "test":
      return { title: "Tincan", body: "Push is working 🎉", url: "/more", tag: "test" };
    case "daily-answer":
      return { title: senderName, body: "answered today's question ✍️ Tap to see it", url: "/", tag: "daily" };
    case "daily-nudge":
      return { title: "Today's question", body: body || "You haven't answered yet 💭", url: "/", tag: "daily" };
    case "streak-risk":
      return { title: "Streak at risk 🔥", body: body || "Open Tincan today to keep it going", url: "/", tag: "streak" };
    case "capsule-unlocked":
      return { title: "Time capsule unlocked ⏳", body: body || "Something from the past is ready to open", url: "/memories/capsules", tag: "capsule" };
    case "envelope-opened":
      return { title: senderName, body: body || "opened one of your envelopes 💌", url: "/memories/envelopes", tag: "envelope" };
    case "jar":
      return { title: senderName, body: "dropped a note in your jar 🫙", url: "/memories/jar", tag: "jar" };
    case "scheduled":
      return { title: senderName, body: (body || "New message").slice(0, 140), url: "/chat", tag: "message" };
    case "milestone":
      return { title: payload.title ?? "Milestone", body: body || "It's today 🎉", url: "/memories", tag: "milestone" };
    case "meetup":
      return { title: payload.title ?? "Meetup soon ✈️", body: body || "", url: "/plan", tag: "meetup" };
    case "yourTurn":
      return { title: senderName, body: body || "It's your turn 🎲", url: d.url ?? "/play", tag: "game" };
    case "invite":
      return { title: senderName, body: body || "wants to play 🎮", url: d.url ?? "/play", tag: "game" };
    case "petHungry":
      return { title: payload.title ?? "Your pet is hungry 🍽️", body: body || "Feed it before it sulks", url: "/", tag: "pet" };
  }
}
