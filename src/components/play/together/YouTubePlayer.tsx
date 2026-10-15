"use client";

import { useEffect, useRef } from "react";

import { loadYouTubeApi, YT_STATE, type YTPlayer } from "@/lib/youtube";

interface YouTubePlayerProps {
  videoId: string | null;
  /** Hidden 1 px player for listen-together. */
  hidden?: boolean;
  onReady: (player: YTPlayer) => void;
  onStateChange: (state: number, player: YTPlayer) => void;
}

/** Thin wrapper over the IFrame API: one player per mount, video swapped via loadVideoById. */
export function YouTubePlayer({ videoId, hidden, onReady, onStateChange }: YouTubePlayerProps) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const loaded = useRef<string | null>(null);
  const cbs = useRef({ onReady, onStateChange });
  useEffect(() => {
    cbs.current = { onReady, onStateChange };
  }, [onReady, onStateChange]);

  useEffect(() => {
    let cancelled = false;
    void loadYouTubeApi().then((YT) => {
      if (cancelled || !host.current) return;
      const el = document.createElement("div");
      host.current.appendChild(el);
      player.current = new YT.Player(el, {
        width: "100%",
        height: "100%",
        videoId: videoId ?? undefined,
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, enablejsapi: 1, origin: window.location.origin },
        events: {
          onReady: (e: { target: YTPlayer }) => {
            loaded.current = videoId;
            cbs.current.onReady(e.target);
          },
          onStateChange: (e: { data: number; target: YTPlayer }) => cbs.current.onStateChange(e.data, e.target),
        },
      });
    });
    return () => {
      cancelled = true;
      player.current?.destroy();
      player.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const p = player.current;
    if (!p || !videoId || loaded.current === videoId) return;
    loaded.current = videoId;
    p.cueVideoById(videoId, 0);
  }, [videoId]);

  return <div ref={host} className={hidden ? "pointer-events-none absolute h-px w-px overflow-hidden opacity-0" : "aspect-video w-full overflow-hidden rounded-[20px] bg-black [&_iframe]:h-full [&_iframe]:w-full"} aria-hidden={hidden} />;
}

export { YT_STATE };
