/**
 * Push notification hook point. Phase 3 only records the intent; phase 5 wires
 * this to POST /api/push. Keep call sites in place so nothing needs re-threading.
 */
export type NotifyType =
  | "message"
  | "ping"
  | "lamp"
  | "yourTurn"
  | "dailyQuestion"
  | "jar"
  | "capsule"
  | "scheduled"
  | "petHungry"
  | "streak"
  | "milestone"
  | "meetup"
  | "invite";

export interface NotifyPayload {
  /** Who should receive it. */
  toUid: string;
  title?: string;
  body?: string;
  /** Extra data for the push (e.g. ping kind, message id). */
  data?: Record<string, string>;
}

export async function notify(type: NotifyType, payload: NotifyPayload): Promise<void> {
  if (process.env.NODE_ENV === "development") {
    console.debug("[notify] (no-op until phase 5)", type, payload);
  }
}
