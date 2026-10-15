"use client";

import { relationshipFor, type RelationshipPreset } from "@/content/relationships";
import { usePair } from "@/hooks/usePair";

/** The pair's relationship preset (default "friends"). */
export function useRelationship(): RelationshipPreset {
  const { pair } = usePair();
  return relationshipFor(pair.relationship);
}
