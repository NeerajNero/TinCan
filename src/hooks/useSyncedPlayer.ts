"use client";

import { useEffect, useRef, useState } from "react";

import { useRtdbValue } from "@/hooks/useRtdbValue";
import { subscribePlayer, writePlayer, type PlayerNode } from "@/lib/db/watch";
import { syncPlan } from "@/lib/playerSync";
import { swallow } from "@/lib/swallow";
import { YT_STATE, type YTPlayer } from "@/lib/youtube";

/** State changes the player reports within this window after we drove it are echoes, not user actions. */
const ECHO_MS = 800;

/**
 * Shared playback for watch/listen together.
 * - Local Play/Pause (`toggle`) calls the player inside the click handler, then writes RTDB,
 *   so the phone counts it as a user gesture.
 * - Remote state is applied (with drift correction every 2 s) only after this client
 *   joined: a one-time "Tap to join" (`join`), a local toggle, or loading a video.
 */
export function useSyncedPlayer(kind: "watch" | "listen", uid: string, onEnded?: (videoId: string) => void) {
  const [node, setNode] = useState<PlayerNode | null | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [joined, setJoined] = useState(false);
  const player = useRef<YTPlayer | null>(null);
  const echoUntil = useRef(0);
  const { value: offset } = useRtdbValue<number>(".info/serverTimeOffset");

  useEffect(() => subscribePlayer(kind, setNode), [kind]);

  useEffect(() => {
    const p = player.current;
    if (!ready || !joined || !p || !node?.videoId) return;
    const run = () => {
      const plan = syncPlan(node, Date.now() + (offset ?? 0), { time: p.getCurrentTime(), state: p.getPlayerState() });
      if (plan.seekTo === null && plan.action === null) return;
      echoUntil.current = Date.now() + ECHO_MS;
      if (plan.seekTo !== null) p.seekTo(plan.seekTo, true);
      if (plan.action === "play") p.playVideo();
      if (plan.action === "pause") p.pauseVideo();
    };
    run();
    const t = setInterval(run, 2000);
    return () => clearInterval(t);
  }, [ready, joined, node, offset]);

  // The player keeps the latest callbacks in a ref, so plain functions are fine here.
  const onReady = (p: YTPlayer) => {
    player.current = p;
    setReady(true);
  };

  const onStateChange = (state: number, p: YTPlayer) => {
    if (state === YT_STATE.ENDED) {
      if (node?.videoId) onEnded?.(node.videoId);
      return;
    }
    if (!joined || Date.now() < echoUntil.current) return;
    if (state === YT_STATE.PLAYING) writePlayer(kind, { playing: true, positionSec: p.getCurrentTime(), by: uid }).catch(swallow);
    if (state === YT_STATE.PAUSED) writePlayer(kind, { playing: false, positionSec: p.getCurrentTime(), by: uid }).catch(swallow);
  };

  /** "Tap to join": runs inside the tap, so play/seek here count as a user gesture. */
  const join = () => {
    setJoined(true);
    const p = player.current;
    if (!p || !node?.videoId) return;
    const plan = syncPlan(node, Date.now() + (offset ?? 0), { time: p.getCurrentTime(), state: p.getPlayerState() });
    echoUntil.current = Date.now() + ECHO_MS;
    if (plan.seekTo !== null) p.seekTo(plan.seekTo, true);
    if (node.playing) p.playVideo();
  };

  /** Local Play/Pause: drive the player first (inside the click), then tell the friend. */
  const toggle = () => {
    const p = player.current;
    if (!p || !node?.videoId) return;
    const play = !node.playing;
    echoUntil.current = Date.now() + ECHO_MS;
    if (play) p.playVideo();
    else p.pauseVideo();
    setJoined(true);
    writePlayer(kind, { playing: play, positionSec: p.getCurrentTime(), by: uid }).catch(swallow);
  };

  const syncToFriend = () => {
    const p = player.current;
    if (!p || !node?.videoId) return;
    writePlayer(kind, { playing: p.getPlayerState() === YT_STATE.PLAYING, positionSec: p.getCurrentTime(), by: uid }).catch(swallow);
  };

  /** Whoever loads a video has joined already (it starts paused; their Play tap is the gesture). */
  const markJoined = () => setJoined(true);

  return { node, ready, joined, onReady, onStateChange, join, toggle, syncToFriend, markJoined };
}
