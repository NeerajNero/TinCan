import { describe, expect, it } from "vitest";

import { admitReaction, expireReactions, GAME_REACTIONS, ingestExisting, isReactionNode, laneFor, REACTION_LIFE_MS, REACTION_MAX_LIVE, REACTION_TAP_GAP_MS, tapAllowed, type LiveReaction } from "@/lib/reactions";

const t0 = 1_700_000_000_000;

/**
 * A stand-in for the RTDB client: `tap` writes one child and, like the SDK,
 * raises child_added once for the sender's optimistic event; the server echo
 * for the same key is a child_changed (different `at`), never a second add.
 * `feed` mirrors what the hook does with each event.
 */
function phone(existing: { id: string; node: unknown }[] = []) {
  const seen = new Set<string>();
  let live: LiveReaction[] = [];
  let animated = 0;
  // mount: everything already there is remembered, never animated
  const swept = ingestExisting(
    seen,
    existing.map((e) => e.id),
  );
  const onChildAdded = (id: string, node: unknown, now: number) => {
    const r = admitReaction(seen, live, id, node, now);
    live = r.live;
    if (r.added) animated++;
  };
  // the SDK also replays the existing children through child_added when the listener attaches
  for (const e of existing) onChildAdded(e.id, e.node, t0);
  let n = 0;
  const tap = (emoji: string, now: number) => {
    const id = `-N${++n}`;
    onChildAdded(id, { by: "me", emoji, at: now }, now); // optimistic
    return id;
  };
  const echo = (id: string, node: unknown, now: number) => onChildAdded(id, node, now); // server echo arriving as an add (shouldn't, but must be harmless)
  return { tap, echo, onChildAdded, get live() { return live; }, get animated() { return animated; }, swept };
}

describe("one tap", () => {
  it("produces exactly one reaction, even when the server echo repeats the key with a different timestamp", () => {
    const p = phone();
    const id = p.tap("👏", t0);
    expect(p.animated).toBe(1);
    expect(p.live.map((r) => r.id)).toEqual([id]);
    p.echo(id, { by: "me", emoji: "👏", at: t0 + 37 }, t0 + 40);
    expect(p.animated).toBe(1);
    expect(p.live).toHaveLength(1);
  });
  it("the other phone animates it once too", () => {
    const p = phone();
    p.onChildAdded("-Nabc", { by: "them", emoji: "😱", at: t0 }, t0 + 100);
    p.onChildAdded("-Nabc", { by: "them", emoji: "😱", at: t0 }, t0 + 120);
    expect(p.animated).toBe(1);
  });
  it("ignores a second tap inside the gap", () => {
    expect(tapAllowed(null, t0)).toBe(true);
    expect(tapAllowed(t0, t0 + REACTION_TAP_GAP_MS - 1)).toBe(false);
    expect(tapAllowed(t0, t0 + REACTION_TAP_GAP_MS)).toBe(true);
  });
});

describe("a snapshot with old children", () => {
  it("animates none of 20 existing children and hands them back for deletion", () => {
    const existing = Array.from({ length: 20 }, (_, i) => ({ id: `-Nold${i}`, node: { by: "them", emoji: "😂", at: t0 - 60_000 + i } }));
    const p = phone(existing);
    expect(p.animated).toBe(0);
    expect(p.live).toEqual([]);
    expect(p.swept).toHaveLength(20);
    // a genuinely new one after mount still shows
    p.onChildAdded("-Nnew", { by: "them", emoji: "🤔", at: t0 }, t0);
    expect(p.animated).toBe(1);
  });
});

describe("feed limits", () => {
  it("keeps at most 12 live, dropping the oldest", () => {
    const p = phone();
    for (let i = 0; i < 15; i++) p.tap("👏", t0 + i);
    expect(p.animated).toBe(15);
    expect(p.live).toHaveLength(REACTION_MAX_LIVE);
    expect(p.live[0]?.id).toBe("-N4");
  });
  it("drops finished animations when a new one arrives and on expiry", () => {
    const p = phone();
    p.tap("👏", t0);
    p.tap("😂", t0 + REACTION_LIFE_MS);
    expect(p.live.map((r) => r.emoji)).toEqual(["😂"]);
    expect(expireReactions(p.live, t0 + 2 * REACTION_LIFE_MS)).toEqual([]);
  });
  it("rejects malformed nodes and spreads copies across lanes", () => {
    const p = phone();
    p.onChildAdded("-Nbad1", { by: "them", emoji: "", at: t0 }, t0);
    p.onChildAdded("-Nbad2", { by: "them", emoji: "😂" }, t0);
    p.onChildAdded("-Nbad3", "😂", t0);
    expect(p.animated).toBe(0);
    expect(isReactionNode({ by: "a", emoji: "👏", at: 1 })).toBe(true);
    for (const id of ["-Na", "-Nb", "-Nc"]) {
      expect(laneFor(id)).toBeGreaterThanOrEqual(0);
      expect(laneFor(id)).toBeLessThanOrEqual(1);
      expect(laneFor(id)).toBe(laneFor(id));
    }
    expect(GAME_REACTIONS).toHaveLength(4);
  });
});
