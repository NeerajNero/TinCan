/**
 * Together-activity hook point for the garden (phase 12). Each first-time
 * event unlocks a sticker there; for now this just records the intent.
 */
export type TogetherEvent = "whiteboard" | "pixel" | "pictionary" | "watch" | "listen" | "focus" | "cook";

export function recordTogetherEvent(kind: TogetherEvent): void {
  if (process.env.NODE_ENV === "development") console.debug("[garden] together event (no-op until phase 12):", kind);
}
