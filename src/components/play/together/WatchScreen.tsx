"use client";

import { Pause, Play } from "lucide-react";
import { useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { ChatDrawer } from "@/components/play/together/ChatDrawer";
import { JoinOverlay } from "@/components/play/together/JoinOverlay";
import { LazyYouTubePlayer as YouTubePlayer } from "@/components/play/together/lazy";
import { PlaylistSection, SaveChip, StarButton, useSaveSuggestion } from "@/components/play/together/Playlist";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { usePair } from "@/hooks/usePair";
import { usePlaylist } from "@/hooks/usePlaylist";
import { useSyncedPlayer } from "@/hooks/useSyncedPlayer";
import { loadVideo } from "@/lib/db/watch";
import { recordTogetherEvent } from "@/lib/garden";
import { hasVideo } from "@/lib/playlist";
import { swallow } from "@/lib/swallow";
import { fetchYouTubeMeta, parseYouTubeId } from "@/lib/youtube";

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
  const { node, ready, joined, onReady, onStateChange, join, toggle, syncToFriend, markJoined } = useSyncedPlayer("watch", uid, () => void recordTogetherEvent("watch", uid));
  const friendName = friend?.nickname ?? "your friend";
  const playlist = usePlaylist("watch", uid);
  const { suggestion, suggest, dismiss } = useSaveSuggestion();
  const isSaved = (id: string) => hasVideo(playlist.items ?? [], id);
  const currentId = node?.videoId ?? null;
  const saved = currentId !== null && isSaved(currentId);
  /** The gesture-safe load: whoever loads has joined; it starts paused for both. */
  const load = async (id: string, title: string, thumb: string) => {
    markJoined();
    await loadVideo("watch", uid, id, title, thumb);
  };

  return (
    <div className="flex flex-col gap-3 pb-20">
      <SubHeader
        help="watch"
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
      <YouTubePlayer videoId={node?.videoId ?? null} onReady={onReady} onStateChange={onStateChange}>
        {ready && node?.videoId && !joined && <JoinOverlay friendName={friendName} playing={node.playing} onJoin={join} />}
      </YouTubePlayer>
      {node?.videoId ? (
        <div className="flex items-center gap-3 px-1">
          <button
            type="button"
            onClick={toggle}
            disabled={!ready}
            aria-label={node.playing ? "Pause for both" : "Play for both"}
            className="tap grid size-12 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-white disabled:opacity-50"
          >
            {node.playing ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
          </button>
          <p className="min-w-0 flex-1 text-sm">
            <span className="block truncate font-semibold">{node.title}</span>
            <span className="text-muted">{ready ? (node.playing ? "playing" : "paused") : "starting the player…"}</span>
          </p>
          {playlist.items !== null && currentId && <StarButton saved={saved} onToggle={() => (saved ? playlist.remove(currentId) : void playlist.save(currentId, node.title))} />}
        </div>
      ) : (
        <Card className="py-6 text-center text-sm text-muted">Load a video and you&apos;ll both see it. Play, pause and seeks stay in step.</Card>
      )}
      <Card className="flex flex-col gap-2">
        <VideoPicker
          onPick={async (id, title, thumb) => {
            await load(id, title, thumb);
            if (!isSaved(id)) suggest(id, title);
          }}
        />
        <SaveChip
          show={suggestion !== null && !isSaved(suggestion.videoId)}
          onSave={() => {
            if (suggestion) void playlist.save(suggestion.videoId, suggestion.title);
            dismiss();
          }}
        />
      </Card>
      <PlaylistSection
        room="watch"
        items={playlist.items}
        currentVideoId={currentId}
        onPlay={(item) => load(item.videoId, item.title, `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`).catch(swallow)}
        onRemove={playlist.remove}
        onMove={playlist.move}
      />
      <ChatDrawer room="watch" />
    </div>
  );
}
