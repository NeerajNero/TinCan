"use client";

import { useEffect, useRef, useState } from "react";

import { LazyYouTubePlayer as YouTubePlayer } from "@/components/play/together/lazy";
import type { YTPlayer } from "@/lib/youtube";

interface HarnessLog {
  ready: boolean;
  states: number[];
}
declare global {
  interface Window {
    __yt?: HarnessLog;
    __ytPlayer?: YTPlayer;
  }
}

/**
 * Drives YouTubePlayer the way Watch/Listen do. `?v=<id>` picks the video;
 * `?late=<ms>` hands the id over only after that delay, as the RTDB
 * `watch/main` value does on a real phone; `?variant=audio` is Listen's
 * covered 200 px player. The buttons call the player inside the click
 * handler, like the screens' Play/Pause.
 */
export function YouTubeHarness() {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [variant, setVariant] = useState<"video" | "audio">("video");
  const player = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    window.__yt = { ready: false, states: [] };
    const params = new URLSearchParams(window.location.search);
    const id = params.get("v") ?? "M7lc1UVf-VE";
    const t = setTimeout(() => {
      setVariant(params.get("variant") === "audio" ? "audio" : "video");
      setVideoId(id);
    }, Number(params.get("late") ?? 0));
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="screen-fixed flex flex-col gap-3 p-4">
      <YouTubePlayer
        key={variant}
        videoId={videoId}
        variant={variant}
        onReady={(p) => {
          player.current = p;
          window.__ytPlayer = p;
          if (window.__yt) window.__yt.ready = true;
          setReady(true);
        }}
        onStateChange={(s) => window.__yt?.states.push(s)}
      >
        {variant === "audio" && <div data-testid="cover" className="absolute inset-0 grid place-items-center bg-surface">🎧 cover</div>}
      </YouTubePlayer>
      <div className="flex gap-2">
        <button type="button" disabled={!ready} onClick={() => player.current?.playVideo()}>
          Play
        </button>
        <button type="button" disabled={!ready} onClick={() => player.current?.pauseVideo()}>
          Pause
        </button>
        <button type="button" disabled={!ready} onClick={() => player.current?.seekTo(30, true)}>
          Seek 30
        </button>
      </div>
    </div>
  );
}
