"use client";

import { Play, Pause, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { ChatDrawer } from "@/components/play/together/ChatDrawer";
import { JoinOverlay } from "@/components/play/together/JoinOverlay";
import { LazyYouTubePlayer as YouTubePlayer } from "@/components/play/together/lazy";
import { PlaylistSection, SaveChip, StarButton, useSaveSuggestion } from "@/components/play/together/Playlist";
import { VideoPicker } from "@/components/play/together/WatchScreen";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { usePair } from "@/hooks/usePair";
import { usePlaylist } from "@/hooks/usePlaylist";
import { useSyncedPlayer } from "@/hooks/useSyncedPlayer";
import { advanceQueue, dequeue, enqueue, enqueueMany, loadVideo, subscribeQueue, type QueueItem } from "@/lib/db/watch";
import { recordTogetherEvent } from "@/lib/garden";
import { hasVideo, type PlaylistItem } from "@/lib/playlist";
import { safeThumb } from "@/lib/safeUrl";
import { swallow } from "@/lib/swallow";

export function ListenScreen() {
  const { uid, me, friend } = usePair();
  const [queue, setQueue] = useState<Array<QueueItem & { id: string }>>([]);
  const onEnded = useCallback(
    (videoId: string) => {
      void recordTogetherEvent("listen", uid);
      void advanceQueue(videoId, uid);
    },
    [uid],
  );
  const { node, ready, joined, onReady, onStateChange, join, toggle, syncToFriend, markJoined } = useSyncedPlayer("listen", uid, onEnded);
  useEffect(() => subscribeQueue(setQueue), []);

  const playlist = usePlaylist("listen", uid);
  const { suggestion, suggest, dismiss } = useSaveSuggestion();
  const isSaved = (id: string) => hasVideo(playlist.items ?? [], id);
  const currentId = node?.videoId ?? null;
  const saved = currentId !== null && isSaved(currentId);
  const queuedIds = useMemo(() => new Set(queue.map((q) => q.videoId)), [queue]);
  const thumbOf = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  const queueItem = (item: PlaylistItem) => ({ videoId: item.videoId, title: item.title, thumb: thumbOf(item.videoId), addedBy: uid });
  /** Plays now for both: this phone has joined, and a joined player starts it through the normal sync. */
  const playNow = (item: PlaylistItem) => {
    markJoined();
    loadVideo("listen", uid, item.videoId, item.title, thumbOf(item.videoId), true).catch(swallow);
  };

  const nameOf = (id: string) => (id === uid ? me.nickname : (friend?.nickname ?? "Friend"));

  return (
    <div className="relative flex flex-col gap-3 pb-20">
      <SubHeader
        help="listen"
        emoji="🎧"
        title="Listen together"
        back="/play"
        screenName="Listen together"
        action={
          <Button variant="soft" onClick={syncToFriend} disabled={!node?.videoId} className="px-3 py-2 text-sm">
            Sync
          </Button>
        }
      />
      {/* The player stays at a real 200 px size under the cover card: YouTube won't play a hidden or 1 px player. */}
      <YouTubePlayer videoId={node?.videoId ?? null} variant="audio" onReady={onReady} onStateChange={onStateChange}>
        <div className="absolute inset-0 flex flex-col justify-end gap-3 bg-surface p-4">
          {safeThumb(node?.thumb) && (
            // eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail
            <img src={node!.thumb as string} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-40 blur-sm" />
          )}
          <div className="relative flex items-center gap-3">
            {safeThumb(node?.thumb) ? // eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail
              <img src={node!.thumb as string} alt="" width={96} height={72} decoding="async" className="h-16 w-24 rounded-xl object-cover shadow" /> : <span className="grid h-16 w-24 place-items-center rounded-xl bg-surface-2 text-3xl">🎧</span>}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{node?.title ?? "Nothing playing"}</p>
              <p className="text-xs text-muted">{node?.videoId ? (!ready ? "Starting the player…" : node.playing ? "Playing for both" : "Paused") : "Add a track below"}</p>
            </div>
            {currentId && playlist.items !== null && <StarButton saved={saved} onToggle={() => (saved ? playlist.remove(currentId) : void playlist.save(currentId, node?.title ?? "YouTube video"))} />}
            {node?.videoId && (
              <button type="button" onClick={toggle} disabled={!ready} aria-label={node.playing ? "Pause for both" : "Play for both"} className="tap grid size-12 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-white disabled:opacity-50">
                {node.playing ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
              </button>
            )}
          </div>
        </div>
        {ready && node?.videoId && !joined && <JoinOverlay friendName={friend?.nickname ?? "your friend"} playing={node.playing} onJoin={join} />}
      </YouTubePlayer>
      <Card className="flex flex-col gap-2">
        <VideoPicker
          label="Add a track (YouTube link)"
          onPick={async (id, title, thumb) => {
            if (!node?.videoId) {
              markJoined();
              await loadVideo("listen", uid, id, title, thumb);
            }
            else await enqueue({ videoId: id, title, thumb, addedBy: uid });
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
      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-muted">Up next</h2>
        {queue.length === 0 && <p className="px-2 text-xs text-muted">Queue is empty. Tracks advance for both of you when one ends.</p>}
        {queue.map((q) => (
          <div key={q.id} className="card flex items-center gap-3 rounded-[20px] px-3 py-2">
            {safeThumb(q.thumb) ? // eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail
            <img src={q.thumb} alt="" width={64} height={48} decoding="async" loading="lazy" className="h-12 w-16 rounded-lg object-cover" /> : <span className="grid h-12 w-16 place-items-center rounded-lg bg-surface-2">🎧</span>}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{q.title}</span>
              <span className="block text-xs text-muted">added by {nameOf(q.addedBy)}</span>
            </span>
            <button type="button" onClick={() => void dequeue(q.id)} aria-label="Remove from queue" className="tap grid size-9 place-items-center rounded-full text-muted">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </section>
      <PlaylistSection
        room="listen"
        items={playlist.items}
        currentVideoId={currentId}
        onPlay={playNow}
        onRemove={playlist.remove}
        onMove={playlist.move}
        onQueue={(item) => enqueue(queueItem(item)).catch(swallow)}
        onQueueAll={() => enqueueMany((playlist.items ?? []).filter((i) => !queuedIds.has(i.videoId)).map(queueItem)).catch(swallow)}
        queuedIds={queuedIds}
      />
      <ChatDrawer room="listen" />
    </div>
  );
}
