/**
 * Client → POST /api/push. Fire-and-forget: the caller never waits on the
 * network and never sees an error. The server decides who gets what.
 */
import { authedFetch } from "@/lib/api";
import type { PushPayload, PushType } from "@/lib/pushTypes";

export type NotifyType = PushType;

export interface NotifyPayload extends PushPayload {
  /** Recipient. Ignored by the server except as a sanity check; the friend is derived from pair/main. */
  toUid?: string;
  /** Only for the "send me a test notification" button. */
  toSelf?: boolean;
}

export function notify(type: NotifyType, payload: NotifyPayload = {}): Promise<void> {
  void authedFetch("/api/push", { method: "POST", body: JSON.stringify({ type, payload, toSelf: payload.toSelf === true }) }).catch(
    () => undefined,
  );
  return Promise.resolve();
}
