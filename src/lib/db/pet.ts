
import { PET_SPECIES } from "@/content/pets";
import { postSystemMessage } from "@/lib/db/home";
import { pairRef } from "@/lib/db/refs";
import { updateDoc } from "@/lib/firebase/fs";
import { recordTogetherEvent } from "@/lib/garden";
import { sinceFor } from "@/lib/pet";
import { writeKey } from "@/lib/petLife";
import type { PetDoc, PetSpecies } from "@/lib/types";

export function adoptPet(species: PetSpecies, name: string, by: string, nickname: string): Promise<void> {
  const now = Date.now();
  const pet: PetDoc = { name: name.trim().slice(0, 24) || PET_SPECIES[species].name, species, hungerAt: now, happyAt: now, sleepAt: 0, level: 1, bornAt: now };
  void postSystemMessage(by, `🐾 ${nickname} adopted ${pet.name} the ${PET_SPECIES[species].name}!`);
  return updateDoc(pairRef(), { pet });
}

export const renamePet = (name: string) => updateDoc(pairRef(), { "pet.name": name.trim().slice(0, 24) });

/** Values this device wrote, so `petEvents` can tell my changes from the friend's. */
const mine = new Set<string>();
/** True (once) if this device wrote that value; consuming it lets a later identical friend write count. */
export const consumeMyPetWrite = (key: string) => mine.delete(key);

function stamp(field: "hungerAt" | "happyAt" | "sleepAt", value: number): Promise<void> {
  mine.add(writeKey(field, value));
  return updateDoc(pairRef(), { [`pet.${field}`]: value });
}

export function feedPet(pet: PetDoc, by: string, nickname: string): Promise<void> {
  void postSystemMessage(by, `🍪 ${nickname} fed ${pet.name}`);
  return stamp("hungerAt", Date.now());
}

export const playWithPet = () => stamp("happyAt", Date.now());
/** A long-press tops happiness up to `happiness`; written once, on release. */
export const pettedPet = (happiness: number) => stamp("happyAt", Math.round(sinceFor(happiness, Date.now())));
export const tuckInPet = () => stamp("sleepAt", Date.now());
export const wakePet = () => stamp("sleepAt", 0);

/** Whoever notices the streak-derived level passed the stored one announces it. */
export async function announceLevel(pet: PetDoc, level: number, by: string): Promise<void> {
  if (level <= pet.level) return;
  await updateDoc(pairRef(), { "pet.level": level });
  void postSystemMessage(by, `🎉 ${pet.name} reached level ${level}!`);
  if (level >= 2) void recordTogetherEvent("pet-level-2", by);
}
