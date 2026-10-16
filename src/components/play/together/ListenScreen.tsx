"use client";

import { Play, Pause, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { ChatDrawer } from "@/components/play/together/ChatDrawer";
import { LazyYouTubePlayer as YouTubePlayer } from "@/components/play/together/lazy";
import { useSyncedPlayer, VideoPicker } from "@/components/play/together/WatchScreen";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { usePair } from "@/hooks/usePair";
import { advanceQueue, dequeue, enqueue, loadVideo, subscribeQueue, writePlayer, type QueueItem } from "@/lib/db/watch";
import { recordTogetherEvent } from "@/lib/garden";
import { safeThumb } from "@/lib/safeUrl";

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
  const { node, onReady, onStateChange, syncToFriend } = useSyncedPlayer("listen", uid, onEnded);
  useEffect(() => subscribeQueue(setQueue), []);

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
      <YouTubePlayer videoId={node?.videoId ?? null} hidden onReady={onReady} onStateChange={onStateChange} />
      <Card className="flex items-center gap-3">
        {safeThumb(node?.thumb) ? // eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail
          <img src={node!.thumb as string} alt="" width={96} height={72} decoding="async" loading="lazy" className="h-16 w-24 rounded-xl object-cover" /> : <span className="grid h-16 w-24 place-items-center rounded-xl bg-surface-2 text-3xl">🎧</span>}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{node?.title ?? "Nothing playing"}</p>
          <p className="text-xs text-muted">{node?.videoId ? (node.playing ? "Playing for both" : "Paused") : "Add a track below"}</p>
        </div>
        {node?.videoId && (
          <button type="button" onClick={() => void writePlayer("listen", { playing: !node.playing, positionSec: node.positionSec, by: uid })} aria-label={node.playing ? "Pause" : "Play"} className="tap grid size-12 place-items-center rounded-full bg-[var(--accent)] text-white">
            {node.playing ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
          </button>
        )}
      </Card>
      <Card className="flex flex-col gap-2">
        <VideoPicker
          label="Add a track (YouTube link)"
          onPick={async (id, title, thumb) => {
            if (!node?.videoId) await loadVideo("listen", uid, id, title, thumb);
            else await enqueue({ videoId: id, title, thumb, addedBy: uid });
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
      <ChatDrawer />
    </div>
  );
}
