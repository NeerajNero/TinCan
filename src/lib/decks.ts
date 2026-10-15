/** The four deck games: content, card access and per-deck behaviour. */
import conversation from "@/content/conversation-cards.json";
import dares from "@/content/dares.json";
import nhie from "@/content/never-have-i-ever.json";
import truths from "@/content/truths.json";
import wyr from "@/content/would-you-rather.json";
import { seededOrder } from "@/lib/seeded";

export { DECK_KINDS, DECK_META, type DeckKind } from "@/lib/deckMeta";
import type { DeckKind } from "@/lib/deckMeta";

export type WyrCard = { a: string; b: string };
export type ConvoCard = { depth: string; text: string };

export function deckSize(kind: DeckKind): number {
  switch (kind) {
    case "wyr":
      return wyr.length;
    case "nhie":
      return nhie.length;
    case "tod":
      return Math.min(truths.length, dares.length);
    case "convo":
      return conversation.length;
  }
}

/** The card at `index` of a seeded shuffle; after the deck is exhausted the caller reseeds. */
export function cardIndexAt(kind: DeckKind, seed: number, index: number): number {
  const n = deckSize(kind);
  return seededOrder(n, seed)[((index % n) + n) % n];
}

export const wyrCard = (i: number): WyrCard => wyr[i];
export const nhieCard = (i: number): string => nhie[i];
export const truthCard = (i: number): string => truths[i % truths.length];
export const dareCard = (i: number): string => dares[i % dares.length];
export const convoCard = (i: number): ConvoCard => conversation[i];
