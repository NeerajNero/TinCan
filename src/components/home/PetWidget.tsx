"use client";

import { MotionConfig } from "framer-motion";
import Link from "next/link";

import { AdoptCard } from "@/components/pet/AdoptCard";
import { StatBar } from "@/components/pet/PetBits";
import { usePet } from "@/components/pet/PetScreen";
import { LevelBadge, PetDim, PetStage } from "@/components/pet/PetStage";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { HowToButton } from "@/components/ui/HowTo";
import { useMilestoneDay } from "@/hooks/useMilestoneDay";
import { usePetLife } from "@/hooks/usePetLife";

const SIZE = 88;

/** Home's pet: the same reactions and sequences as /pet at a smaller size, without particles. */
export function PetWidget() {
  const { pet, stats, level } = usePet();
  const life = usePetLife({ pet, stats, level, size: SIZE, compact: true });
  const accessory = useMilestoneDay().accessory;
  if (!pet || !stats) return <AdoptCard />;
  const disabled = stats.sleeping || life.busy;
  return (
    <MotionConfig reducedMotion="user">
      <Card className="relative flex items-center gap-3 p-3">
        <PetDim on={life.dimmed} />
        <PetStage life={life} pet={pet} level={level} size={SIZE} compact accessory={accessory} />
        <div className="relative flex min-w-0 flex-1 flex-col gap-1.5">
          <Link href="/pet" className="font-heading text-lg font-semibold leading-tight">
            {pet.name}{" "}
            <span className="text-xs font-bold text-muted">
              <LevelBadge value={life.levelShown} prefix="lvl" />
            </span>
          </Link>
          <StatBar label="Food" value={life.hunger} color="#ffb454" />
          <StatBar label="Joy" value={life.happiness} color="#ff8fab" />
          <div className="flex gap-2 pt-0.5">
            <Button onClick={life.feed} disabled={disabled} className="px-3 py-1.5 text-xs">
              🍪 Feed
            </Button>
            <Link href="/pet" className={`tap inline-flex items-center rounded-full bg-accent-soft px-3 text-xs font-bold ${disabled ? "pointer-events-none opacity-50" : ""}`}>
              🎾 Play
            </Link>
          </div>
        </div>
        <HowToButton topic="pet" autoOpen={false} className="relative self-start" />
      </Card>
    </MotionConfig>
  );
}
