// @vitest-environment happy-dom
/**
 * The reaction hook against a fake RTDB client, rendered inside StrictMode
 * (as the app is): children in the first snapshot never animate and are
 * deleted; every child_added after that animates once, the sender's own tap
 * included (it comes back through the same listener), and leaves after its
 * animation.
 */
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useGameReactions } from "@/hooks/useGameReactions";
import { REACTION_LIFE_MS } from "@/lib/reactions";

interface FakeChild {
  key: string;
  val: () => unknown;
}
const fake = {
  initial: [] as FakeChild[],
  listeners: [] as Array<(c: FakeChild) => void>,
  removed: [] as string[],
  sent: [] as string[],
};

vi.mock("@/lib/rtdb", () => ({ rtdbRef: (path: string) => ({ path }) }));
vi.mock("@/lib/db/reactions", () => ({
  gameReactionsPath: (id: string) => `gameReactions/${id}`,
  sendGameReaction: async (_gameId: string, by: string, emoji: string) => {
    const key = `-Nsent${fake.sent.length}`;
    fake.sent.push(key);
    // The SDK raises child_added for the writer's own push at once (optimistic), then echoes it.
    for (const l of fake.listeners) l({ key, val: () => ({ by, emoji, at: 1 }) });
    for (const l of fake.listeners) l({ key, val: () => ({ by, emoji, at: 2 }) });
    return key;
  },
}));
vi.mock("@/lib/firebase/rt", () => ({
  get: async () => ({ forEach: (fn: (c: FakeChild) => void) => fake.initial.forEach(fn) }),
  onChildAdded: (_q: unknown, cb: (c: FakeChild) => void) => {
    fake.listeners.push(cb);
    // Like the SDK: existing children are delivered through child_added when the listener attaches.
    for (const c of fake.initial) cb(c);
    return () => {
      fake.listeners = fake.listeners.filter((l) => l !== cb);
    };
  },
  query: (r: unknown) => r,
  limitToLast: () => undefined,
  remove: async (r: { path: string }) => {
    fake.removed.push(r.path);
  },
}));

function Probe() {
  const { live, react } = useGameReactions("g1", "me");
  return (
    <button type="button" onClick={() => react("👏")} data-live={live.map((r) => r.id).join(",")}>
      react
    </button>
  );
}

let root: Root;
let host: HTMLElement;
const flush = () => act(async () => {});

beforeEach(() => {
  vi.useFakeTimers();
  fake.initial = [];
  fake.listeners = [];
  fake.removed = [];
  fake.sent = [];
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

const mount = async () => {
  await act(async () => {
    root.render(
      <StrictMode>
        <Probe />
      </StrictMode>,
    );
  });
  await flush();
};
const liveIds = () => host.querySelector("button")?.getAttribute("data-live") ?? "";
const tap = () => act(async () => host.querySelector("button")?.click());
const emit = async (key: string, node: unknown) => {
  await act(async () => {
    for (const l of fake.listeners) l({ key, val: () => node });
  });
};

describe("useGameReactions", () => {
  it("never animates the first snapshot's children and deletes them; a later child_added animates once", async () => {
    fake.initial = Array.from({ length: 20 }, (_, i) => ({ key: `-Nold${i}`, val: () => ({ by: "them", emoji: "😂", at: i }) }));
    await mount();
    expect(liveIds()).toBe("");
    expect(new Set(fake.removed).size).toBe(20);
    await emit("-Nnew", { by: "them", emoji: "🤔", at: 5 });
    expect(liveIds()).toBe("-Nnew");
    await emit("-Nnew", { by: "them", emoji: "🤔", at: 6 }); // the echo
    expect(liveIds()).toBe("-Nnew");
  });

  it("the sender's own tap animates exactly once through the same child_added path", async () => {
    await mount();
    await tap();
    await flush();
    expect(fake.sent).toHaveLength(1);
    expect(liveIds()).toBe("-Nsent0");
    await tap(); // inside the tap gap: ignored
    expect(fake.sent).toHaveLength(1);
    expect(liveIds()).toBe("-Nsent0");
  });

  it("a reaction leaves after its animation", async () => {
    await mount();
    await emit("-Na", { by: "them", emoji: "😱", at: 1 });
    expect(liveIds()).toBe("-Na");
    await act(async () => {
      vi.advanceTimersByTime(REACTION_LIFE_MS + 10);
    });
    expect(liveIds()).toBe("");
  });
});
