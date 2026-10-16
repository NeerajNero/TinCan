"use client";

import { m } from "framer-motion";
import Link from "next/link";

import { AdoptCard } from "@/components/pet/AdoptCard";
import { StatBar } from "@/components/pet/PetBits";
import { usePet } from "@/components/pet/PetScreen";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PetSprite } from "@/content/pets";
import { feedPet } from "@/lib/db/pet";

export function PetWidget() {
  const { uid, me, pet, stats, level } = usePet();
  if (!pet || !stats) return <AdoptCard />;
  return (
    <Card className="flex items-center gap-3 p-3">
      <Link href="/pet" aria-label={`Open ${pet.name}`} className="shrink-0">
        <m.div animate={stats.sleeping ? { y: [0, 2, 0] } : { y: [0, -3, 0] }} transition={{ duration: stats.sleeping ? 3 : 2, repeat: Infinity, ease: "easeInOut" }}>
          <PetSprite species={pet.species} mood={stats.mood} level={level} size={88} />
        </m.div>
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Link href="/pet" className="font-heading text-lg font-semibold leading-tight">
          {pet.name} <span className="text-xs font-bold text-muted">lvl {level}</span>
        </Link>
        <StatBar label="Food" value={stats.hunger} color="#ffb454" />
        <StatBar label="Joy" value={stats.happiness} color="#ff8fab" />
        <div className="flex gap-2 pt-0.5">
          <Button onClick={() => void feedPet(pet, uid, me.nickname)} disabled={stats.sleeping} className="px-3 py-1.5 text-xs">
            🍪 Feed
          </Button>
          <Link href="/pet" className={`tap inline-flex items-center rounded-full bg-accent-soft px-3 text-xs font-bold ${stats.sleeping ? "pointer-events-none opacity-50" : ""}`}>
            🎾 Play
          </Link>
        </div>
      </div>
    </Card>
  );
}
