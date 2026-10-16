"use client";

import { AnimatePresence, m } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { AdoptCard } from "@/components/pet/AdoptCard";
import { StatBar } from "@/components/pet/PetBits";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PET_SPECIES, PetSprite } from "@/content/pets";
import { useNow } from "@/hooks/useNow";
import { usePair } from "@/hooks/usePair";
import { announceLevel, feedPet, playWithPet, tuckInPet, wakePet } from "@/lib/db/pet";
import { formatClock } from "@/lib/media/recorder";
import { levelFor, petStats } from "@/lib/pet";

const PLAY_MS = 5000;

/** Shared hook: stats, level sync, feed animation state. */
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
  const { uid, me, pet, stats, level, now } = usePet();
  const [eating, setEating] = useState(0);
  const [game, setGame] = useState<{ endsAt: number; taps: number } | null>(null);
  const [bounce, setBounce] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        <SubHeader emoji="🐾" title="Pet" back="/" />
        <AdoptCard />
      </div>
    );
  }

  const species = PET_SPECIES[pet.species];
  const disabled = stats.sleeping;

  function feed() {
    if (!pet || disabled) return;
    setEating((e) => e + 1);
    void feedPet(pet, uid, me.nickname);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setEating(0), 1400);
  }
  function tap() {
    if (!game) return;
    setGame((g) => (g ? { ...g, taps: g.taps + 1 } : g));
    setBounce((b) => b + 1);
    try {
      navigator.vibrate?.(10);
    } catch {
      // no haptics
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SubHeader emoji="🐾" title={pet.name} back="/" />
      <Card className="flex flex-col items-center gap-3 py-6">
        <m.button
          type="button"
          onClick={tap}
          disabled={!game}
          aria-label={game ? "Tap to bounce" : pet.name}
          animate={
            game && bounce ? { y: [0, -28, 0], scale: [1, 1.08, 1] } : eating ? { rotate: [0, -6, 6, -4, 4, 0], scale: [1, 1.05, 1] } : stats.sleeping ? { y: [0, 2, 0] } : { y: [0, -3, 0] }
          }
          transition={game && bounce ? { duration: 0.35, ease: "easeOut" } : eating ? { duration: 0.6 } : { duration: stats.sleeping ? 3 : 2, repeat: Infinity, ease: "easeInOut" }}
          key={game ? `b${bounce}` : eating ? `e${eating}` : "idle"}
          className="relative"
        >
          <PetSprite species={pet.species} mood={stats.mood} level={level} size={180} />
          <AnimatePresence>
            {eating > 0 && (
              <m.span key={eating} initial={{ opacity: 1, y: 0, scale: 1 }} animate={{ opacity: 0, y: -40, scale: 1.4 }} transition={{ duration: 1.2 }} className="pointer-events-none absolute top-6 left-1/2 -translate-x-1/2 text-3xl" aria-hidden>
                🍪
              </m.span>
            )}
          </AnimatePresence>
        </m.button>
        <div>
          <p className="text-center font-heading text-xl font-semibold">
            {pet.name} <span className="text-sm font-bold text-muted">· {species.name} · level {level}</span>
          </p>
          <p className="text-center text-xs text-muted">
            {stats.sleeping && stats.wakesAt ? `Sleeping · wakes in ${formatClock(stats.wakesAt - now.getTime())}` : stats.mood === "hungry" ? "Hungry — a snack would be nice" : stats.mood === "sad" ? "A bit lonely — up for a game?" : "Doing great"}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 px-2">
          <StatBar label="Food" value={stats.hunger} color="#ffb454" />
          <StatBar label="Joy" value={stats.happiness} color="#ff8fab" />
        </div>
      </Card>

      {game ? (
        <Card className="flex flex-col items-center gap-1 text-center">
          <p className="font-heading text-lg font-semibold">Tap {pet.name}!</p>
          <p className="text-xs text-muted">{Math.max(0, Math.ceil((game.endsAt - now.getTime()) / 1000))}s left · {game.taps} bounces</p>
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <Button onClick={feed} disabled={disabled} className="flex-col gap-0 py-3">
            <span className="text-2xl">🍪</span>
            <span className="text-xs">Feed</span>
          </Button>
          <Button onClick={() => setGame({ endsAt: Date.now() + PLAY_MS, taps: 0 })} disabled={disabled} className="flex-col gap-0 py-3">
            <span className="text-2xl">🎾</span>
            <span className="text-xs">Play</span>
          </Button>
          {stats.sleeping ? (
            <Button variant="soft" onClick={() => void wakePet()} className="flex-col gap-0 py-3">
              <span className="text-2xl">☀️</span>
              <span className="text-xs">Wake up</span>
            </Button>
          ) : (
            <Button variant="soft" onClick={() => void tuckInPet()} className="flex-col gap-0 py-3">
              <span className="text-2xl">🌙</span>
              <span className="text-xs">Tuck in</span>
            </Button>
          )}
        </div>
      )}
      <p className="px-2 text-center text-xs text-muted">Food and joy drain over 24 hours. Level climbs with your streak: every 7 days. Rename in More.</p>
    </div>
  );
}
