"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/media/recorder";

/* Only one note plays at a time: the last one to start pauses the previous. */
let active: HTMLAudioElement | null = null;
function claim(el: HTMLAudioElement) {
  if (active && active !== el) active.pause();
  active = el;
}

interface VoicePlayerProps {
  url: string;
  durationMs: number;
  mine: boolean;
}

export function VoicePlayer({ url, durationMs, mine }: VoicePlayerProps) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [rate, setRate] = useState<1 | 1.5>(1);
  const [knownDuration, setKnownDuration] = useState(durationMs / 1000);

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    const onTime = () => setPosition(el.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setPosition(0);
    };
    const onMeta = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) setKnownDuration(el.duration);
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    el.addEventListener("loadedmetadata", onMeta);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("loadedmetadata", onMeta);
      el.pause();
      if (active === el) active = null;
    };
  }, []);

  useEffect(() => {
    if (audio.current) audio.current.playbackRate = rate;
  }, [rate]);

  function toggle() {
    const el = audio.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      claim(el);
      el.playbackRate = rate;
      void el.play().catch(() => setPlaying(false));
    }
  }

  function scrub(e: React.ChangeEvent<HTMLInputElement>) {
    const el = audio.current;
    const t = Number(e.target.value);
    setPosition(t);
    if (el) el.currentTime = t;
  }

  const shown = playing || position > 0 ? position : knownDuration;

  return (
    <div className="flex w-56 max-w-full items-center gap-2 py-0.5">
      <audio ref={audio} src={url} preload="metadata" />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play voice note"}
        className={cn("tap grid size-10 shrink-0 place-items-center rounded-full", mine ? "bg-[var(--accent)] text-white" : "bg-accent-soft text-text")}
      >
        {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <input
          type="range"
          min={0}
          max={knownDuration || 1}
          step={0.05}
          value={position}
          onChange={scrub}
          aria-label="Seek"
          className="h-1.5 w-full cursor-pointer accent-[var(--accent)]"
        />
        <div className="flex items-center justify-between text-[11px] text-muted">
          <span className="tabular-nums">{formatClock(shown * 1000)}</span>
          <button
            type="button"
            onClick={() => setRate((r) => (r === 1 ? 1.5 : 1))}
            aria-label={`Playback speed ${rate}x`}
            className="tap -my-2 rounded-full px-2 font-bold"
          >
            {rate}×
          </button>
        </div>
      </div>
    </div>
  );
}
