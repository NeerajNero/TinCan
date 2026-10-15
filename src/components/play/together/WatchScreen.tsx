"use client";

import { useEffect, useRef, useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { ChatDrawer } from "@/components/play/together/ChatDrawer";
import { YouTubePlayer } from "@/components/play/together/YouTubePlayer";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { usePair } from "@/hooks/usePair";
import { useRtdbValue } from "@/hooks/useRtdbValue";
import { loadVideo, subscribePlayer, writePlayer, type PlayerNode } from "@/lib/db/watch";
import { recordTogetherEvent } from "@/lib/garden";
import { fetchYouTubeMeta, parseYouTubeId, YT_STATE, type YTPlayer } from "@/lib/youtube";

const DRIFT_SEC = 2;

/** Shared playback: user actions write state; the other client applies it and corrects drift. */
export function useSyncedPlayer(kind: "watch" | "listen", uid: string, onEnded?: (videoId: string) => void) {
  const [node, setNode] = useState<PlayerNode | null | undefined>(undefined);
  const player = useRef<YTPlayer | null>(null);
  const applying = useRef(false);
  const { value: offset } = useRtdbValue<number>(".info/serverTimeOffset");
  const serverNow = () => Date.now() + (offset ?? 0);

  useEffect(() => subscribePlayer(kind, setNode), [kind]);

  // Apply remote state (and correct drift every 2 s).
  useEffect(() => {
    const p = player.current;
    if (!p || !node?.videoId) return;
    const apply = () => {
      const expected = node.playing ? node.positionSec + (serverNow() - node.updatedAt) / 1000 : node.positionSec;
      const state = p.getPlayerState();
      applying.current = true;
      if (Math.abs(p.getCurrentTime() - expected) > DRIFT_SEC) p.seekTo(expected, true);
      if (node.playing && state !== YT_STATE.PLAYING && state !== YT_STATE.BUFFERING) p.playVideo();
      if (!node.playing && state === YT_STATE.PLAYING) p.pauseVideo();
      setTimeout(() => (applying.current = false), 600);
    };
    apply();
    const t = setInterval(apply, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.videoId, node?.playing, node?.positionSec, node?.updatedAt, offset]);

  // The player keeps the latest callbacks in a ref, so plain functions are fine here.
  const onReady = (p: YTPlayer) => {
    player.current = p;
    setNode((n) => (n ? { ...n } : n));
  };

  const onStateChange = (state: number, p: YTPlayer) => {
    if (state === YT_STATE.ENDED) {
      if (node?.videoId) onEnded?.(node.videoId);
      return;
    }
    if (applying.current) return;
    if (state === YT_STATE.PLAYING) void writePlayer(kind, { playing: true, positionSec: p.getCurrentTime(), by: uid });
    if (state === YT_STATE.PAUSED) void writePlayer(kind, { playing: false, positionSec: p.getCurrentTime(), by: uid });
  };

  const syncToFriend = () => {
    const p = player.current;
    if (!p || !node?.videoId) return;
    void writePlayer(kind, { playing: p.getPlayerState() === YT_STATE.PLAYING, positionSec: p.getCurrentTime(), by: uid });
  };

  return { node, onReady, onStateChange, syncToFriend };
}

export function VideoPicker({ onPick, label = "Paste a YouTube link or id" }: { onPick: (id: string, title: string, thumb: string) => Promise<void>; label?: string }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    const id = parseYouTubeId(input);
    if (!id) return setError("That doesn't look like a YouTube link.");
    setBusy(true);
    setError(null);
    try {
      const meta = await fetchYouTubeMeta(id).catch(() => ({ title: "YouTube video", thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }));
      await onPick(id, meta.title, meta.thumb);
      setInput("");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        void go();
      }}
    >
      <div className="flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder={label} aria-label={label} inputMode="url" />
        <Button type="submit" disabled={!input.trim() || busy} className="shrink-0 px-4">
          {busy ? "…" : "Load"}
        </Button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </form>
  );
}

export function WatchScreen() {
  const { uid, friend } = usePair();
  const { node, onReady, onStateChange, syncToFriend } = useSyncedPlayer("watch", uid, () => void recordTogetherEvent("watch", uid));

  return (
    <div className="flex flex-col gap-3 pb-20">
      <SubHeader
        emoji="📺"
        title="Watch together"
        back="/play"
        screenName="Watch together"
        action={
          <Button variant="soft" onClick={syncToFriend} disabled={!node?.videoId} className="px-3 py-2 text-sm">
            Sync to {friend?.nickname ?? "friend"}
          </Button>
        }
      />
      <YouTubePlayer videoId={node?.videoId ?? null} onReady={onReady} onStateChange={onStateChange} />
      {node?.videoId ? (
        <p className="px-1 text-sm">
          <span className="font-semibold">{node.title}</span>
          <span className="text-muted"> · {node.playing ? "playing" : "paused"}</span>
        </p>
      ) : (
        <Card className="py-6 text-center text-sm text-muted">Load a video and you&apos;ll both see it. Play, pause and seeks stay in step.</Card>
      )}
      <Card className="flex flex-col gap-2">
        <VideoPicker onPick={(id, title, thumb) => loadVideo("watch", uid, id, title, thumb)} />
      </Card>
      <ChatDrawer />
    </div>
  );
}
