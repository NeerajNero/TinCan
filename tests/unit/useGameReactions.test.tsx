// @vitest-environment happy-dom
/**
 * The reaction hook against a fake RTDB SDK (the real `lib/firebase/rt`
 * wrapper runs, so its Diagnostics lines can be counted), rendered inside
 * StrictMode as the app is: the first snapshot never animates and is deleted;
 * every key that appears later animates once, the sender's own tap included
 * (it comes back through the same listener), and leaves after its animation.
 * One screen attaches exactly one listener. A transport cancel re-attaches
 * once after a backoff; a rules denial is logged once and never retried.
 */
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useGameReactions } from "@/hooks/useGameReactions";
import { diagEntries } from "@/lib/diagLog";
import { REACTION_LIFE_MS } from "@/lib/reactions";

interface FakeChild {
  key: string;
  val: () => unknown;
}
interface FakeSnap {
  forEach: (fn: (c: FakeChild) => void) => void;
}
const snapOf = (children: readonly FakeChild[]): FakeSnap => ({ forEach: (fn) => children.forEach((c) => fn(c)) });

const fake = {
  /** The node's children right now. */
  children: [] as FakeChild[],
  listeners: [] as Array<(s: FakeSnap) => void>,
  removed: [] as string[],
  sent: [] as string[],
  sentTo: [] as string[],
  /** Attachments so far; the first `failFirst` of them are cancelled with `failWith()` instead of delivering data. */
  attached: 0,
  failFirst: 0,
  failWith: (): Error => new Error("Client is offline"),
};
const emitAll = () => {
  for (const l of fake.listeners) l(snapOf(fake.children));
};
const upsert = (key: string, node: unknown) => {
  const child = { key, val: () => node };
  const i = fake.children.findIndex((c) => c.key === key);
  if (i >= 0) fake.children[i] = child;
  else fake.children.push(child);
};

vi.mock("@/lib/rtdb", () => ({ rtdbRef: (path: string) => ({ path, toString: () => `https://fake.firebaseio.com/${path}` }) }));
vi.mock("@/lib/db/reactions", () => ({
  gameReactionsPath: (id: string) => `gameReactions/${id}`,
  sendGameReaction: async (gameId: string, by: string, emoji: string) => {
    const key = `-Nsent${fake.sent.length}`;
    fake.sent.push(key);
    fake.sentTo.push(`gameReactions/${gameId}`);
    // The SDK raises a value event for the writer's own push at once (optimistic), then again on the server echo.
    upsert(key, { by, emoji, at: 1 });
    emitAll();
    upsert(key, { by, emoji, at: 2 });
    emitAll();
    return key;
  },
}));
vi.mock("firebase/database", () => ({
  onValue: (_q: unknown, cb: (s: FakeSnap) => void, cancel: (e: Error) => void) => {
    fake.attached += 1;
    if (fake.attached <= fake.failFirst) {
      // Like the SDK: the refusal arrives later, the registration is dropped and its cancel callback told.
      queueMicrotask(() => cancel(fake.failWith()));
      return () => undefined;
    }
    fake.listeners.push(cb);
    // The first value event: everything that is there now.
    queueMicrotask(() => cb(snapOf(fake.children)));
    return () => {
      fake.listeners = fake.listeners.filter((l) => l !== cb);
    };
  },
  onChildAdded: () => {
    throw new Error("useGameReactions must attach exactly one value listener");
  },
  query: (r: unknown) => r,
  limitToLast: () => undefined,
  remove: async (r: { path: string }) => {
    fake.removed.push(r.path);
    const key = r.path.slice(r.path.lastIndexOf("/") + 1);
    fake.children = fake.children.filter((c) => c.key !== key);
  },
}));

function Probe({ gameId = "g1" }: { gameId?: string }) {
  const { live, react } = useGameReactions(gameId, "me");
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
  fake.children = [];
  fake.listeners = [];
  fake.removed = [];
  fake.sent = [];
  fake.sentTo = [];
  fake.attached = 0;
  fake.failFirst = 0;
  fake.failWith = () => new Error("Client is offline");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

const mount = async (gameId?: string, strict = true) => {
  await act(async () => {
    root.render(strict ? <StrictMode><Probe gameId={gameId} /></StrictMode> : <Probe gameId={gameId} />);
  });
  await flush();
};
const liveIds = () => host.querySelector("button")?.getAttribute("data-live") ?? "";
const tap = () => act(async () => host.querySelector("button")?.click());
const emit = async (key: string, node: unknown) => {
  await act(async () => {
    upsert(key, node);
    emitAll();
  });
};
const readLines = (path: string) => diagEntries().filter((e) => e.kind === "read" && e.text.includes(path));

describe("useGameReactions", () => {
  it("never animates the first snapshot's children and deletes them; a key that appears later animates once", async () => {
    fake.children = Array.from({ length: 12 }, (_, i) => ({ key: `-Nold${i}`, val: () => ({ by: "them", emoji: "😂", at: i }) }));
    await mount();
    expect(liveIds()).toBe("");
    expect(new Set(fake.removed).size).toBe(12);
    await emit("-Nnew", { by: "them", emoji: "🤔", at: 5 });
    expect(liveIds()).toBe("-Nnew");
    await emit("-Nnew", { by: "them", emoji: "🤔", at: 6 }); // the echo
    expect(liveIds()).toBe("-Nnew");
  });

  it("the sender's own tap animates exactly once through the same listener", async () => {
    await mount();
    await tap();
    await flush();
    expect(fake.sent).toHaveLength(1);
    expect(liveIds()).toBe("-Nsent0");
    await tap(); // inside the tap gap: ignored
    expect(fake.sent).toHaveLength(1);
    expect(liveIds()).toBe("-Nsent0");
  });

  it("Battleship: writes under that game's id and animates there, pending shot or not", async () => {
    const BATTLESHIP = "-Nbattleship42";
    await mount(BATTLESHIP);
    await tap();
    await flush();
    expect(fake.sentTo).toEqual([`gameReactions/${BATTLESHIP}`]);
    expect(liveIds()).toBe("-Nsent0");
    // The friend's reaction during my pending shot arrives through the same listener.
    await emit("-Ntheirs", { by: "them", emoji: "😱", at: 3 });
    expect(liveIds()).toBe("-Nsent0,-Ntheirs");
  });

  it("one screen attaches exactly one listener", async () => {
    await mount("g1", false);
    expect(fake.attached).toBe(1);
    expect(fake.listeners).toHaveLength(1);
    await act(() => root.unmount());
    expect(fake.listeners).toHaveLength(0);
    // StrictMode mounts, unmounts and mounts again: still one live listener.
    root = createRoot(host);
    await mount();
    expect(fake.listeners).toHaveLength(1);
  });

  it("a transport cancel re-attaches once after the backoff and then works", async () => {
    // StrictMode attaches twice on mount; both are cancelled ("Client is offline"), so only the backoff can recover.
    fake.failFirst = 2;
    fake.children = [{ key: "-Nold", val: () => ({ by: "them", emoji: "😂", at: 1 }) }];
    await mount();
    expect(fake.attached).toBe(2);
    expect(fake.listeners).toHaveLength(0);
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    await flush();
    expect(fake.attached).toBe(3);
    expect(fake.listeners).toHaveLength(1);
    expect(liveIds()).toBe(""); // the late first snapshot still counts as existing
    expect(fake.removed).toEqual(["gameReactions/g1/-Nold"]);
    await emit("-Nafter", { by: "them", emoji: "🤔", at: 2 });
    expect(liveIds()).toBe("-Nafter");
    // Nothing else is waiting: no second retry, no doubling.
    await act(async () => {
      vi.advanceTimersByTime(120_000);
    });
    expect(fake.attached).toBe(3);
    expect(fake.listeners).toHaveLength(1);
  });

  it("a rules denial is logged once and never retried", async () => {
    const DENIED = "g-denied";
    fake.failFirst = Number.POSITIVE_INFINITY;
    fake.failWith = () => Object.assign(new Error("permission_denied at /gameReactions/g-denied: Client doesn't have permission to access the desired data."), { code: "PERMISSION_DENIED" });
    const before = readLines(DENIED).length;
    await mount(DENIED, false);
    expect(fake.attached).toBe(1);
    await act(async () => {
      vi.advanceTimersByTime(120_000);
    });
    await flush();
    expect(fake.attached).toBe(1);
    const lines = readLines(DENIED).slice(before);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.text).toContain(`onValue gameReactions/${DENIED} → PERMISSION_DENIED`);
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
