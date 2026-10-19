"use client";

import { m } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useNow } from "@/hooks/useNow";
import { usePair } from "@/hooks/usePair";
import { useRtdbValue } from "@/hooks/useRtdbValue";
import { cn } from "@/lib/cn";
import { roomDateKey } from "@/lib/dates";
import { pairRef } from "@/lib/db/refs";
import { claimFocusCompletion, DEFAULT_TIMER, subscribeTimer, writeTimer, type TimerNode } from "@/lib/db/together";
import { increment, updateDoc } from "@/lib/firebase/fs";
import { recordTogetherEvent } from "@/lib/garden";
import { formatClock } from "@/lib/media/recorder";
import { swallow } from "@/lib/swallow";
/** Two short Web Audio tones; no asset needed. */
function chime() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    [0, 0.25].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = i === 0 ? 880 : 1174;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.6);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.65);
    });
  } catch {
    // No audio context; silence is fine.
  }
}

export function TimerScreen() {
  const { uid, me, friend, pair } = usePair();
  const [node, setNode] = useState<TimerNode | null>(null);
  const { value: offset } = useRtdbValue<number>(".info/serverTimeOffset");
  const now = useNow(250);
  const handled = useRef<number | null>(null);
  useEffect(() => subscribeTimer((n) => setNode(n ?? DEFAULT_TIMER)), []);

  const t = node ?? DEFAULT_TIMER;
  const serverNow = now.getTime() + (offset ?? 0);
  const remaining = t.running ? Math.max(0, t.endsAt - serverNow) : t.remainingMs;
  const total = (t.mode === "focus" ? t.focusMin : t.breakMin) * 60_000;
  const today = roomDateKey(pair, now);
  const sessionsToday = pair.focusSessions?.[today] ?? 0;

  // Phase end: chime for everyone; one client claims the completion and counts it.
  useEffect(() => {
    if (!t.running || remaining > 0 || handled.current === t.endsAt) return;
    handled.current = t.endsAt;
    chime();
    if (t.mode === "focus") {
      void claimFocusCompletion(t.endsAt).then((won) => {
        if (!won) return;
        void recordTogetherEvent("focus", uid);
        void updateDoc(pairRef(), { [`focusSessions.${today}`]: increment(1) }).catch(swallow);
      });
    } else {
      void writeTimer({ mode: "focus", running: false, endsAt: 0, remainingMs: t.focusMin * 60_000 });
    }
  }, [t, remaining, today, uid]);

  const start = () => writeTimer({ running: true, endsAt: serverNow + remaining, startedBy: uid });
  const pause = () => writeTimer({ running: false, endsAt: 0, remainingMs: remaining });
  const reset = () => writeTimer({ ...DEFAULT_TIMER, mode: t.mode, remainingMs: (t.mode === "focus" ? t.focusMin : t.breakMin) * 60_000, focusMin: t.focusMin, breakMin: t.breakMin });
  const switchMode = (mode: "focus" | "break") => writeTimer({ mode, running: false, endsAt: 0, remainingMs: (mode === "focus" ? t.focusMin : t.breakMin) * 60_000 });

  const pct = total ? remaining / total : 0;
  const r = 70;
  const c = 2 * Math.PI * r;

  return (
    <div className="flex flex-col gap-4">
      <SubHeader help="timer" emoji="⏱️" title="Focus timer" back="/play" screenName="the focus timer" invite={{ activity: "timer", route: "/play/timer", label: "a Focus session" }} />
      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
        {(["focus", "break"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={t.mode === m} onClick={() => void switchMode(m)} className={cn("tap rounded-full py-2 text-sm font-bold", t.mode === m ? "bg-surface shadow-sm" : "text-muted")}>
            {m === "focus" ? `Focus ${t.focusMin}` : `Break ${t.breakMin}`}
          </button>
        ))}
      </div>
      <Card className="flex flex-col items-center gap-3 py-6">
        <div className="relative">
          <svg width="180" height="180" viewBox="0 0 180 180" aria-hidden>
            <circle cx="90" cy="90" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
            <m.circle cx="90" cy="90" r={r} fill="none" stroke={t.mode === "focus" ? "var(--accent)" : "var(--accent-plan)"} strokeWidth="10" strokeLinecap="round" strokeDasharray={c} animate={{ strokeDashoffset: c * (1 - pct) }} transition={{ duration: 0.25 }} transform="rotate(-90 90 90)" />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <p className="font-heading text-4xl font-semibold tabular-nums" aria-live="polite">
              {formatClock(remaining)}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted">{t.running ? `Running · started by ${t.startedBy === uid ? me.nickname : (friend?.nickname ?? "friend")}` : "Paused · both see this clock"}</p>
        <div className="flex gap-2">
          {t.running ? (
            <Button onClick={() => void pause()} className="px-6">
              Pause
            </Button>
          ) : (
            <Button onClick={() => void start()} disabled={remaining <= 0} className="px-6">
              Start
            </Button>
          )}
          <Button variant="ghost" onClick={() => void reset()}>
            Reset
          </Button>
        </div>
      </Card>
      <Card className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden>
          🍅
        </span>
        <p className="text-sm">
          <span className="font-heading text-xl font-semibold">{sessionsToday}</span> focus {sessionsToday === 1 ? "session" : "sessions"} today, together
        </p>
      </Card>
    </div>
  );
}
