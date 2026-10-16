"use client";

import { Play } from "lucide-react";

/**
 * Phones only let a page start sound from a tap. Until this tap, remote
 * play/pause/seek is not applied; the tap itself starts playback in the same
 * click handler, which unlocks the player for the rest of the visit.
 */
export function JoinOverlay({ friendName, playing, onJoin }: { friendName: string; playing: boolean; onJoin: () => void }) {
  return (
    <button
      type="button"
      onClick={onJoin}
      className="tap absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/60 text-white backdrop-blur-[2px]"
    >
      <span className="grid size-16 place-items-center rounded-full bg-[var(--accent)] shadow-lg">
        <Play size={28} className="ml-1" aria-hidden />
      </span>
      <span className="font-heading text-lg font-semibold">Tap to join {friendName}</span>
      <span className="text-xs opacity-80">{playing ? "Playing now" : "Paused, you'll stay in step"}</span>
    </button>
  );
}
