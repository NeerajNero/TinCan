/**
 * What a client must do to match the shared watch/listen state. Pure, so the
 * drift rules are unit-tested; useSyncedPlayer applies the plan to YT.Player.
 */
import { YT_STATE } from "@/lib/youtube";

const DRIFT_SEC = 2;

export interface SharedPlayback {
  playing: boolean;
  positionSec: number;
  /** Server epoch ms of the last write. */
  updatedAt: number;
}

export interface SyncPlan {
  seekTo: number | null;
  action: "play" | "pause" | null;
}

/** Where the shared playhead is now, in seconds. */
function expectedPosition(node: SharedPlayback, serverNow: number): number {
  return node.playing ? node.positionSec + Math.max(0, serverNow - node.updatedAt) / 1000 : node.positionSec;
}

export function syncPlan(node: SharedPlayback, serverNow: number, local: { time: number; state: number }): SyncPlan {
  const expected = expectedPosition(node, serverNow);
  const seekTo = Math.abs(local.time - expected) > DRIFT_SEC ? expected : null;
  let action: SyncPlan["action"] = null;
  if (node.playing && local.state !== YT_STATE.PLAYING && local.state !== YT_STATE.BUFFERING) action = "play";
  if (!node.playing && (local.state === YT_STATE.PLAYING || local.state === YT_STATE.BUFFERING)) action = "pause";
  return { seekTo, action };
}
