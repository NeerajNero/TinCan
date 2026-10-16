"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { noteDiag } from "@/lib/diagLog";
import { loadYouTubeApi, youTubeErrorMessage, type YTPlayer } from "@/lib/youtube";

interface YouTubePlayerProps {
  videoId: string | null;
  /**
   * "video": a 16:9 player. "audio" (listen together): a 200 px tall player,
   * the minimum YouTube requires, kept at full size under `children` (the
   * thumbnail card). Never display:none or 1 px: YouTube refuses to play those.
   */
  variant?: "video" | "audio";
  onReady: (player: YTPlayer) => void;
  onStateChange: (state: number, player: YTPlayer) => void;
  /** Laid over the player: the listen cover card, the "Tap to join" overlay. */
  children?: React.ReactNode;
}

interface Failure {
  videoId: string | null;
  message: string;
}

/**
 * Thin wrapper over the IFrame API: one player per mount, built only once the
 * mount node exists, the API has loaded *and* a video id is known (YT.Player
 * throws "Invalid video id" without one, which left a bare black box when the
 * RTDB value arrived after mount). Later ids are cued on the same player.
 * Unmounting (route change) destroys it.
 */
export function YouTubePlayer({ videoId, variant = "video", onReady, onStateChange, children }: YouTubePlayerProps) {
  const mount = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const building = useRef(false);
  const ready = useRef(false);
  const cued = useRef<string | null>(null);
  const want = useRef(videoId);
  const alive = useRef(true);
  const cbs = useRef({ onReady, onStateChange });
  const [failure, setFailure] = useState<Failure | null>(null);

  useEffect(() => {
    cbs.current = { onReady, onStateChange };
  }, [onReady, onStateChange]);

  // Destroy on unmount (route change); remove the iframe even if YT never got ready.
  useEffect(() => {
    alive.current = true;
    const host = mount.current;
    return () => {
      alive.current = false;
      ready.current = false;
      building.current = false;
      cued.current = null;
      const p = player.current;
      player.current = null;
      try {
        p?.destroy();
      } catch {
        // destroying a half-built player can throw; the DOM is cleared below anyway
      }
      host?.replaceChildren();
    };
  }, []);

  useEffect(() => {
    want.current = videoId;
    if (!videoId) return;
    const p = player.current;
    if (p) {
      if (ready.current && cued.current !== videoId) {
        cued.current = videoId;
        p.cueVideoById(videoId, 0);
      }
      return;
    }
    if (building.current) return;
    building.current = true;
    loadYouTubeApi()
      .then((YT) => {
        const host = mount.current;
        const id = want.current;
        if (!alive.current || !host || !id) {
          building.current = false;
          return;
        }
        const el = document.createElement("div");
        host.replaceChildren(el);
        cued.current = id;
        player.current = new YT.Player(el, {
          // Privacy-enhanced mode: YouTube sets no cookies until the video plays.
          host: "https://www.youtube-nocookie.com",
          width: "100%",
          height: "100%",
          videoId: id,
          playerVars: { playsinline: 1, rel: 0, modestbranding: 1, enablejsapi: 1, origin: window.location.origin },
          events: {
            onReady: (e: { target: YTPlayer }) => {
              if (!alive.current) return;
              ready.current = true;
              const latest = want.current;
              if (latest && cued.current !== latest) {
                cued.current = latest;
                e.target.cueVideoById(latest, 0);
              }
              cbs.current.onReady(e.target);
            },
            onStateChange: (e: { data: number; target: YTPlayer }) => cbs.current.onStateChange(e.data, e.target),
            onError: (e: { data: number }) => {
              const message = youTubeErrorMessage(e.data);
              noteDiag("player", `YouTube error ${e.data} for ${want.current ?? "?"}: ${message}`);
              if (alive.current) setFailure({ videoId: want.current, message });
            },
          },
        });
      })
      .catch((err: unknown) => {
        building.current = false;
        noteDiag("player", `YouTube player failed to start: ${err instanceof Error ? err.message : String(err)}`);
        if (alive.current) setFailure({ videoId: null, message: "Couldn't start the YouTube player. Check your connection and reopen this screen." });
      });
  }, [videoId]);

  const error = failure && (failure.videoId === null || failure.videoId === videoId) ? failure.message : null;
  const audio = variant === "audio";

  return (
    <div className={cn("relative w-full min-w-[200px] overflow-hidden rounded-[20px] bg-black", audio ? "h-[200px]" : "aspect-video")}>
      <div ref={mount} className="absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full" aria-hidden={audio || undefined} inert={audio || undefined} />
      {children}
      {error && (
        <div role="alert" className="absolute inset-0 grid place-items-center bg-black/80 p-6 text-center text-sm font-semibold text-white">
          {error}
        </div>
      )}
    </div>
  );
}
