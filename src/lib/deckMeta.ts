/** Deck names and labels only — no card content — so headers and the Play landing stay light. */
export type DeckKind = "wyr" | "nhie" | "tod" | "convo";
export const DECK_KINDS: readonly DeckKind[] = ["wyr", "nhie", "tod", "convo"];

export const DECK_META: Record<DeckKind, { name: string; emoji: string; blurb: string }> = {
  wyr: { name: "Would You Rather", emoji: "🤔", blurb: "Pick A or B, then compare" },
  nhie: { name: "Never Have I Ever", emoji: "🙈", blurb: "Confess and collect points" },
  tod: { name: "Truth or Dare", emoji: "🎯", blurb: "Spin, then deliver" },
  convo: { name: "Conversation cards", emoji: "💬", blurb: "Light and deep prompts" },
};
