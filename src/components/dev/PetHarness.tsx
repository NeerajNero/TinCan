"use client";

import { MotionConfig } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { StatBar } from "@/components/pet/PetBits";
import { PetDim, PetStage } from "@/components/pet/PetStage";
import type { IncomingPing } from "@/hooks/useIncomingPings";
import { useNow } from "@/hooks/useNow";
import { usePetMotion, type PetEnv } from "@/hooks/usePetLife";
import { petStats, sinceFor } from "@/lib/pet";
import { writeKey } from "@/lib/petLife";
import type { PetDoc } from "@/lib/types";

interface PetLog {
  writes: { kind: string; at: number; value?: number }[];
  toasts: string[];
}
declare global {
  interface Window {
    __pet?: PetLog;
  }
}

const HOUR = 3_600_000;

/**
 * Drives the pet stage the way PetScreen/PetWidget do, with a local pet doc.
 * "Me" writes record their values like `lib/db/pet` does, so they aren't
 * replayed; the "Friend …" buttons change the doc without that, like a
 * snapshot from the other phone. `?compact=1` renders the Home widget size.
 * Every write and toast lands in `window.__pet`.
 */
export function PetHarness({ compact }: { compact: boolean }) {
  const [pet, setPet] = useState<PetDoc>(() => {
    const now = Date.now();
    return { name: "Momo", species: "blob", hungerAt: now - 16 * HOUR, happyAt: now - 12 * HOUR, sleepAt: 0, level: 1, bornAt: now };
  });
  const [ping, setPing] = useState<IncomingPing | null>(null);
  const mine = useRef(new Set<string>());
  const now = useNow(1000);
  const stats = petStats(pet, now.getTime());

  useEffect(() => {
    window.__pet = { writes: [], toasts: [] };
  }, []);

  const log = (kind: string, value?: number) => window.__pet?.writes.push({ kind, at: performance.now(), value });
  const stamp = useCallback((field: "hungerAt" | "happyAt" | "sleepAt", value: number, own: boolean) => {
    if (own) mine.current.add(writeKey(field, value));
    setPet((p) => ({ ...p, [field]: value }));
  }, []);

  const write = useMemo<PetEnv["write"]>(
    () => ({
      feed: () => {
        log("feed");
        stamp("hungerAt", Date.now(), true);
      },
      tuckIn: () => {
        log("tuckIn");
        stamp("sleepAt", Date.now(), true);
      },
      wake: () => {
        log("wake");
        stamp("sleepAt", 0, true);
      },
      petted: (v) => {
        log("petted", v);
        stamp("happyAt", Math.round(sinceFor(v, Date.now())), true);
      },
    }),
    [stamp],
  );
  const env = useMemo<PetEnv>(
    () => ({ friendName: "Sam", ping, toast: (t) => window.__pet?.toasts.push(t.title), write, isMine: (key) => mine.current.delete(key) }),
    [ping, write],
  );

  const size = compact ? 88 : 180;
  const life = usePetMotion({ pet, stats, level: pet.level, size, compact }, env);
  const disabled = stats.sleeping || life.busy;

  return (
    <MotionConfig reducedMotion="user">
      <main className="screen-fixed flex flex-col items-center gap-4 overflow-y-auto p-4">
        <div className="card relative flex w-full max-w-sm flex-col items-center gap-3 p-5">
          <PetDim on={life.dimmed} />
          <PetStage life={life} pet={pet} level={pet.level} size={size} compact={compact} />
          <p data-testid="mood" className="relative text-sm">
            {life.mood} · level {life.levelShown}
          </p>
          <div className="relative flex w-full flex-col gap-2">
            <StatBar label="Food" value={life.hunger} color="#ffb454" />
            <StatBar label="Joy" value={life.happiness} color="#ff8fab" />
          </div>
        </div>
        <div className="grid w-full max-w-sm grid-cols-2 gap-2 text-sm">
          <button type="button" className="tap rounded-full bg-accent-soft p-2 disabled:opacity-50" onClick={life.feed} disabled={disabled}>
            Feed
          </button>
          <button type="button" className="tap rounded-full bg-accent-soft p-2 disabled:opacity-50" onClick={stats.sleeping ? life.wake : life.tuckIn} disabled={life.busy}>
            {stats.sleeping ? "Wake up" : "Tuck in"}
          </button>
          <button type="button" className="tap rounded-full bg-surface-2 p-2" onClick={() => stamp("hungerAt", Date.now(), false)}>
            Friend feeds
          </button>
          <button type="button" className="tap rounded-full bg-surface-2 p-2" onClick={() => stamp("sleepAt", pet.sleepAt ? 0 : Date.now(), false)}>
            Friend sleep/wake
          </button>
          <button type="button" className="tap rounded-full bg-surface-2 p-2" onClick={() => setPet((p) => ({ ...p, level: p.level + 1 }))}>
            Level up
          </button>
          <button type="button" className="tap rounded-full bg-surface-2 p-2" onClick={() => setPing({ from: "friend", kind: "hug", at: Date.now(), nonce: String(Date.now()) })}>
            Hug ping
          </button>
        </div>
      </main>
    </MotionConfig>
  );
}
