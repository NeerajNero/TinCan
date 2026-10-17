"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { Card } from "@/components/ui/Card";
import { usePair } from "@/hooks/usePair";
import { cn } from "@/lib/cn";
import { setRadio, subscribeRadio, type RadioNode } from "@/lib/db/together";
import { readPref, writePref } from "@/lib/localPref";
import { LAST_STATION_KEY, playbackMode, STATIONS, type Station } from "@/lib/radio";
import { swallow } from "@/lib/swallow";

const HLS_MIME = "application/vnd.apple.mpegurl";
const SECTIONS: Array<{ region: Station["region"]; title: string }> = [
  { region: "India", title: "India" },
  { region: "World", title: "World" },
];

type Problem = "cors" | "unsupported" | null;

export function RadioScreen() {
  const { uid, me, friend } = usePair();
  const [node, setNode] = useState<RadioNode | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [problem, setProblem] = useState<{ stationId: string; kind: Problem } | null>(null);
  const [lastId, setLastId] = useState(() => readPref(LAST_STATION_KEY(uid)));
  const audio = useRef<HTMLAudioElement>(null);
  useEffect(() => subscribeRadio(setNode), []);

  const station = STATIONS.find((s) => s.id === node?.stationId) ?? null;
  const playing = Boolean(node?.playing);
  const last = STATIONS.find((s) => s.id === lastId) ?? null;

  // Follow the shared state. Native playback for mp3/aac and for HLS where the browser has it
  // (Android Chrome); hls.js, loaded only here and only for that station, elsewhere.
  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    if (!station || !playing) {
      el.pause();
      return;
    }
    let cancelled = false;
    let destroy: (() => void) | null = null;
    const start = () =>
      el
        .play()
        .then(() => setBlocked(false))
        .catch(() => !cancelled && setBlocked(true));

    if (playbackMode(station, el.canPlayType(HLS_MIME)) === "src") {
      if (el.src !== station.url) el.src = station.url;
      void start();
    } else {
      el.removeAttribute("src");
      void import("hls.js/light")
        .then(({ default: Hls }) => {
          if (cancelled) return;
          if (!Hls.isSupported()) return setProblem({ stationId: station.id, kind: "unsupported" });
          const hls = new Hls({ lowLatencyMode: false });
          destroy = () => hls.destroy();
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;
            // A playlist or segment request with no HTTP status at all, while online, is the
            // browser refusing a response without CORS headers.
            const noResponse = data.type === Hls.ErrorTypes.NETWORK_ERROR && !data.response?.code;
            setProblem({ stationId: station.id, kind: noResponse && navigator.onLine ? "cors" : "unsupported" });
            hls.destroy();
          });
          hls.loadSource(station.url);
          hls.attachMedia(el);
          void start();
        })
        .catch(() => !cancelled && setProblem({ stationId: station.id, kind: "unsupported" }));
    }
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [station, playing]);

  function toggle(s: Station) {
    const next = node?.stationId === s.id ? !node.playing : true;
    if (next) {
      writePref(LAST_STATION_KEY(uid), s.id);
      setLastId(s.id);
      setProblem(null);
    }
    void setRadio({ stationId: s.id, playing: next, by: uid }).catch(swallow);
  }

  const shownProblem = problem && station && problem.stationId === station.id && playing ? problem.kind : null;
  const attributions = Array.from(new Set(STATIONS.map((s) => s.attribution.split(" — ")[0]?.split(" (")[0] ?? s.attribution)));

  return (
    <div className="flex flex-col gap-3">
      <SubHeader help="radio" emoji="📻" title="Radio" back="/play" screenName="the radio" />
      <audio ref={audio} preload="none" />
      <Card className="flex items-center gap-3">
        <span className="text-3xl" aria-hidden>
          📻
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{station?.name ?? "Pick a station"}</p>
          <p className="text-xs text-muted">{station ? (playing ? `Playing · started by ${node?.by === uid ? me.nickname : (friend?.nickname ?? "friend")}` : "Paused") : "Same station, both phones"}</p>
        </div>
        {!playing && last && (
          <button type="button" onClick={() => toggle(last)} aria-label={`Play ${last.name} again`} className="tap shrink-0 rounded-full bg-accent-soft px-3 text-xs font-bold">
            ▶ {last.name.split(" · ")[0]}
          </button>
        )}
      </Card>
      {blocked && !shownProblem && (
        <button type="button" onClick={() => audio.current?.play().then(() => setBlocked(false)).catch(swallow)} className="tap rounded-2xl bg-accent-soft px-4 py-3 text-sm font-bold">
          Tap to start audio on this device
        </button>
      )}
      {shownProblem && (
        <p role="status" className="rounded-2xl bg-surface-2 px-4 py-3 text-sm">
          {shownProblem === "cors" ? "This station only plays in the mobile app" : "This browser can't play this station — try it on your phone"}
        </p>
      )}
      {SECTIONS.map(({ region, title }) => (
        <section key={region} className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-muted">{title}</h2>
          {STATIONS.filter((s) => s.region === region).map((s) => {
            const active = node?.stationId === s.id && playing;
            return (
              <button key={s.id} type="button" onClick={() => toggle(s)} aria-pressed={active} className={cn("card tap flex items-center gap-3 rounded-[20px] px-4 py-3 text-left", active && "ring-2 ring-[var(--accent)]")}>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft">{active ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-semibold">{s.name}</span>
                    {s.language && <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold text-muted">{s.language}</span>}
                  </span>
                  <span className="block text-xs text-muted">
                    {s.genre}
                    {s.id === lastId && !active && " · last played"}
                  </span>
                </span>
              </button>
            );
          })}
        </section>
      ))}
      <p className="px-2 text-center text-[11px] text-muted">Streams by {attributions.join(" and ")}. Thank them.</p>
    </div>
  );
}
