"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { Card } from "@/components/ui/Card";
import stations from "@/content/radio.json";
import { usePair } from "@/hooks/usePair";
import { cn } from "@/lib/cn";
import { setRadio, subscribeRadio, type RadioNode } from "@/lib/db/together";
import { swallow } from "@/lib/swallow";
interface Station {
  id: string;
  name: string;
  genre: string;
  url: string;
  attribution: string;
}
const STATIONS = stations as Station[];

export function RadioScreen() {
  const { uid, me, friend } = usePair();
  const [node, setNode] = useState<RadioNode | null>(null);
  const [blocked, setBlocked] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  useEffect(() => subscribeRadio(setNode), []);

  const station = STATIONS.find((s) => s.id === node?.stationId) ?? null;

  // Follow the shared state; autoplay may need a tap on this device.
  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    if (!station || !node?.playing) {
      el.pause();
      return;
    }
    if (el.src !== station.url) el.src = station.url;
    el.play()
      .then(() => setBlocked(false))
      .catch(() => setBlocked(true));
  }, [station, node?.playing]);

  function toggle(s: Station) {
    const playing = node?.stationId === s.id ? !node.playing : true;
    void setRadio({ stationId: s.id, playing, by: uid });
  }

  return (
    <div className="flex flex-col gap-3">
      <SubHeader emoji="📻" title="Radio" back="/play" screenName="the radio" />
      <audio ref={audio} preload="none" />
      <Card className="flex items-center gap-3">
        <span className="text-3xl" aria-hidden>
          📻
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{station?.name ?? "Pick a station"}</p>
          <p className="text-xs text-muted">{station ? (node?.playing ? `Playing · started by ${node.by === uid ? me.nickname : (friend?.nickname ?? "friend")}` : "Paused") : "Same station, both phones"}</p>
        </div>
      </Card>
      {blocked && (
        <button type="button" onClick={() => audio.current?.play().then(() => setBlocked(false)).catch(swallow)} className="tap rounded-2xl bg-accent-soft px-4 py-3 text-sm font-bold">
          Tap to start audio on this device
        </button>
      )}
      <div className="flex flex-col gap-2">
        {STATIONS.map((s) => {
          const active = node?.stationId === s.id && node.playing;
          return (
            <button key={s.id} type="button" onClick={() => toggle(s)} aria-pressed={active} className={cn("card tap flex items-center gap-3 rounded-[20px] px-4 py-3 text-left", active && "ring-2 ring-[var(--accent)]")}>
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft">{active ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{s.name}</span>
                <span className="block text-xs text-muted">{s.genre}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="px-2 text-center text-[11px] text-muted">Streams by {Array.from(new Set(STATIONS.map((s) => s.attribution.split(" — ")[0]?.split(" (")[0] ?? s.attribution))).join(" and ")}. Thank them.</p>
    </div>
  );
}
