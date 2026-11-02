"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Sheet } from "@/components/ui/Sheet";
import { formatClock } from "@/lib/media/recorder";

interface ViewOnceVoiceProps {
  /** Signed audio URL (with `?once=1`); null closes the sheet. */
  url: string | null;
  durationMs: number;
  /** Called once: when the note ends or the sheet is closed. */
  onDone: () => void;
}

/**
 * A view-once voice note: plays once, no scrub, no speed. Closing early or
 * reaching the end both count as opened, so the asset goes away either way.
 */
export function ViewOnceVoice({ url, durationMs, onDone }: ViewOnceVoiceProps) {
  return (
    <Sheet open={url !== null} onClose={onDone} label="Voice note, plays once" className="flex flex-col items-center gap-3 px-5 pb-2 text-center">
      {url && <Player url={url} durationMs={durationMs} onEnded={onDone} />}
    </Sheet>
  );
}

function Player({ url, durationMs, onEnded }: { url: string; durationMs: number; onEnded: () => void }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    const onTime = () => setPosition(el.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    void el.play().catch(() => setPlaying(false));
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
      el.pause();
    };
  }, [onEnded]);

  const total = Math.max(1, durationMs / 1000);
  return (
    <>
      <audio ref={audio} src={url} preload="auto" />
      <p className="font-heading text-xl font-semibold">👁️ Plays once</p>
      <button type="button" onClick={() => (playing ? audio.current?.pause() : void audio.current?.play().catch(() => undefined))} aria-label={playing ? "Pause" : "Play"} className="tap grid size-16 place-items-center rounded-full bg-[var(--accent)] text-white">
        {playing ? <Pause size={26} /> : <Play size={26} className="ml-1" />}
      </button>
      <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div className="h-full rounded-full bg-[var(--accent)] transition-[width]" style={{ width: `${Math.min(100, (position / total) * 100)}%` }} />
      </div>
      <p className="text-xs tabular-nums text-muted">
        {formatClock(position * 1000)} / {formatClock(durationMs)}
      </p>
      <p className="text-xs text-muted">Closing this counts as opened — the note is gone afterwards.</p>
    </>
  );
}
