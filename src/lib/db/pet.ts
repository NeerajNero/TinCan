import { updateDoc } from "firebase/firestore";

import { PET_SPECIES } from "@/content/pets";
import { postSystemMessage } from "@/lib/db/home";
import { pairRef } from "@/lib/db/refs";
import { recordTogetherEvent } from "@/lib/garden";
import type { PetDoc, PetSpecies } from "@/lib/types";

export function adoptPet(species: PetSpecies, name: string, by: string, nickname: string): Promise<void> {
  const now = Date.now();
  const pet: PetDoc = { name: name.trim().slice(0, 24) || PET_SPECIES[species].name, species, hungerAt: now, happyAt: now, sleepAt: 0, level: 1, bornAt: now };
  void postSystemMessage(by, `🐾 ${nickname} adopted ${pet.name} the ${PET_SPECIES[species].name}!`);
  return updateDoc(pairRef(), { pet });
}

export const renamePet = (name: string) => updateDoc(pairRef(), { "pet.name": name.trim().slice(0, 24) });

export function feedPet(pet: PetDoc, by: string, nickname: string): Promise<void> {
  void postSystemMessage(by, `🍪 ${nickname} fed ${pet.name}`);
  return updateDoc(pairRef(), { "pet.hungerAt": Date.now() });
}

export const playWithPet = () => updateDoc(pairRef(), { "pet.happyAt": Date.now() });
export const tuckInPet = () => updateDoc(pairRef(), { "pet.sleepAt": Date.now() });
export const wakePet = () => updateDoc(pairRef(), { "pet.sleepAt": 0 });

/** Whoever notices the streak-derived level passed the stored one announces it. */
export async function announceLevel(pet: PetDoc, level: number, by: string): Promise<void> {
  if (level <= pet.level) return;
  await updateDoc(pairRef(), { "pet.level": level });
  void postSystemMessage(by, `🎉 ${pet.name} reached level ${level}!`);
  if (level >= 2) void recordTogetherEvent("pet-level-2", by);
}
