"use client";

import { useState } from "react";

import { PET_SPECIES, PetSprite } from "@/content/pets";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { usePair } from "@/hooks/usePair";
import { cn } from "@/lib/cn";
import { adoptPet } from "@/lib/db/pet";
import type { PetSpecies } from "@/lib/types";

/** First open: pick one of three and name it. Either person can do this. */
export function AdoptCard() {
  const { uid, me } = usePair();
  const [species, setSpecies] = useState<PetSpecies>("blob");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function adopt() {
    setBusy(true);
    try {
      await adoptPet(species, name, uid, me.nickname);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="font-heading text-lg font-semibold">Adopt a pet together</p>
        <p className="text-xs text-muted">You both look after it. Feed it, play with it, tuck it in.</p>
      </div>
      <div role="radiogroup" aria-label="Species" className="grid grid-cols-3 gap-2">
        {(Object.keys(PET_SPECIES) as PetSpecies[]).map((sp) => (
          <button key={sp} type="button" role="radio" aria-checked={species === sp} onClick={() => setSpecies(sp)} className={cn("tap flex flex-col items-center gap-1 rounded-2xl p-2", species === sp ? "bg-accent-soft ring-2 ring-[var(--accent)]" : "bg-surface-2")}>
            <PetSprite species={sp} mood="happy" level={1} size={72} />
            <span className="text-sm font-bold">{PET_SPECIES[sp].name}</span>
          </button>
        ))}
      </div>
      <p className="text-center text-xs text-muted">{PET_SPECIES[species].blurb}</p>
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value.slice(0, 24))} placeholder={`Name your ${PET_SPECIES[species].name}`} aria-label="Pet name" />
        <Button onClick={adopt} disabled={busy} className="shrink-0 px-4">
          {busy ? "…" : "Adopt"}
        </Button>
      </div>
    </Card>
  );
}
