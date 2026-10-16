/** How the two of you describe yourselves. Drives wording across the app. */
import type { PingKind } from "@/lib/types";

export interface RelationshipPreset {
  id: string;
  emoji: string;
  label: string;
  /** Plural noun for the two of you ("friends", "lovebirds"). */
  pairNoun: string;
  /** Label for the date in More ("Friends since"). */
  sinceLabel: string;
  /** Yearly derived milestone title. */
  anniversaryLabel: string;
  /** An extra ping button for presets that earn one. */
  extraPing?: PingKind;
}

export const RELATIONSHIPS: readonly RelationshipPreset[] = [
  { id: "friends", emoji: "🧡", label: "Friends", pairNoun: "friends", sinceLabel: "Friends since", anniversaryLabel: "Friendiversary" },
  { id: "best-friends", emoji: "💛", label: "Best friends", pairNoun: "besties", sinceLabel: "Besties since", anniversaryLabel: "Bestiversary" },
  { id: "love-birds", emoji: "💕", label: "Love birds", pairNoun: "lovebirds", sinceLabel: "Together since", anniversaryLabel: "Anniversary", extraPing: "kiss" },
  { id: "soulmates", emoji: "✨", label: "Soulmates", pairNoun: "soulmates", sinceLabel: "Together since", anniversaryLabel: "Anniversary", extraPing: "kiss" },
  { id: "siblings", emoji: "🫶", label: "Siblings", pairNoun: "siblings", sinceLabel: "Siblings forever", anniversaryLabel: "Sibling day" },
  { id: "partners-in-crime", emoji: "🕵️", label: "Partners in crime", pairNoun: "accomplices", sinceLabel: "Accomplices since", anniversaryLabel: "Heist-iversary" },
  { id: "family", emoji: "🏡", label: "Family", pairNoun: "family", sinceLabel: "Family since forever", anniversaryLabel: "Family day" },
  { id: "pen-pals", emoji: "✉️", label: "Pen pals", pairNoun: "pen pals", sinceLabel: "Writing since", anniversaryLabel: "Pen-pal-iversary" },
];

const DEFAULT_RELATIONSHIP: RelationshipPreset = RELATIONSHIPS[0]!;

export function relationshipFor(id: string | null | undefined): RelationshipPreset {
  return RELATIONSHIPS.find((r) => r.id === id) ?? DEFAULT_RELATIONSHIP;
}
