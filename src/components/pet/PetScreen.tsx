"use client";

import { MotionConfig } from "framer-motion";
import { useCallback, useEffect, useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { AdoptCard } from "@/components/pet/AdoptCard";
import { StatBar } from "@/components/pet/PetBits";
import { LevelBadge, PetDim, PetStage } from "@/components/pet/PetStage";
import { Confetti } from "@/components/plan/Confetti";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PET_SPECIES } from "@/content/pets";
import { useNow } from "@/hooks/useNow";
import { usePair } from "@/hooks/usePair";
import { usePetLife } from "@/hooks/usePetLife";
import { announceLevel, playWithPet } from "@/lib/db/pet";
import { formatClock } from "@/lib/media/recorder";
import { levelFor, petStats } from "@/lib/pet";

const PLAY_MS = 5000;
const SIZE = 180;

/** Shared hook: stats and level sync. */
export function usePet() {
  const { uid, me, pair } = usePair();
  const now = useNow(1000);
  const pet = pair.pet ?? null;
  const stats = pet ? petStats(pet, now.getTime()) : null;
  const level = levelFor(pair.streak?.count ?? 0);

  // Level-ups are announced once by whoever notices.
  useEffect(() => {
    if (pet && level > pet.level) void announceLevel(pet, level, uid);
  }, [pet, level, uid]);

  return { uid, me, pet, stats, level: pet ? Math.max(level, pet.level) : level, now };
}

export function PetScreen() {
  const { pet, stats, level, now } = usePet();
  const [game, setGame] = useState<{ endsAt: number; taps: number } | null>(null);
  const countTap = useCallback(() => setGame((g) => (g ? { ...g, taps: g.taps + 1 } : g)), []);
  const life = usePetLife({ pet, stats, level, size: SIZE, onTap: countTap });

  // Mini-game: 5 seconds of tapping, then the pet is happy.
  useEffect(() => {
    if (!game) return;
    const t = setTimeout(() => {
      void playWithPet();
      setGame(null);
    }, Math.max(0, game.endsAt - Date.now()));
    return () => clearTimeout(t);
  }, [game]);

  if (!pet || !stats) {
    return (
      <div className="flex flex-col gap-4">
        <SubHeader help="pet" emoji="🐾" title="Pet" back="/" />
        <AdoptCard />
      </div>
    );
  }

  const species = PET_SPECIES[pet.species];
  const asleep = life.mood === "sleeping";
  const disabled = stats.sleeping || life.busy;

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-col gap-4">
        <SubHeader help="pet" emoji="🐾" title={pet.name} back="/" />
        <Card className="relative flex flex-col items-center gap-3 py-6">
          <PetDim on={life.dimmed} />
          <PetStage life={life} pet={pet} level={level} size={SIZE} />
          <div className="relative">
            <p className="text-center font-heading text-xl font-semibold">
              {pet.name}{" "}
              <span className="text-sm font-bold text-muted">
                · {species.name} · <LevelBadge value={life.levelShown} prefix="level" />
              </span>
            </p>
            <p className="text-center text-xs text-muted">
              {asleep && stats.wakesAt ? `Sleeping · wakes in ${formatClock(stats.wakesAt - now.getTime())}` : stats.mood === "hungry" ? "Hungry — a snack would be nice" : stats.mood === "sad" ? "A bit lonely — up for a game?" : "Doing great · tap to play, hold to pet"}
            </p>
          </div>
          <div className="relative flex w-full flex-col gap-2 px-2">
            <StatBar label="Food" value={life.hunger} color="#ffb454" />
            <StatBar label="Joy" value={life.happiness} color="#ff8fab" />
          </div>
        </Card>

        {game ? (
          <Card className="flex flex-col items-center gap-1 text-center">
            <p className="font-heading text-lg font-semibold">Tap {pet.name}!</p>
            <p className="text-xs text-muted">
              {Math.max(0, Math.ceil((game.endsAt - now.getTime()) / 1000))}s left · {game.taps} bounces
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <Button onClick={life.feed} disabled={disabled} className="flex-col gap-0 py-3">
              <span className="text-2xl">🍪</span>
              <span className="text-xs">Feed</span>
            </Button>
            <Button onClick={() => setGame({ endsAt: Date.now() + PLAY_MS, taps: 0 })} disabled={disabled} className="flex-col gap-0 py-3">
              <span className="text-2xl">🎾</span>
              <span className="text-xs">Play</span>
            </Button>
            {stats.sleeping ? (
              <Button variant="soft" onClick={life.wake} disabled={life.busy} className="flex-col gap-0 py-3">
                <span className="text-2xl">☀️</span>
                <span className="text-xs">Wake up</span>
              </Button>
            ) : (
              <Button variant="soft" onClick={life.tuckIn} disabled={life.busy} className="flex-col gap-0 py-3">
                <span className="text-2xl">🌙</span>
                <span className="text-xs">Tuck in</span>
              </Button>
            )}
          </div>
        )}
        <p className="px-2 text-center text-xs text-muted">Food and joy drain over 24 hours. Level climbs with your streak: every 7 days. Rename in More.</p>
        <Confetti burst={life.confetti} />
      </div>
    </MotionConfig>
  );
}
