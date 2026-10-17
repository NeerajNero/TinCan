// @vitest-environment happy-dom
/**
 * Phase 18: system lines rendered as blank gaps. Every system line must show
 * text — written text, else one derived from kind + meta, else ✨ — and the
 * chat scroller must be positioned so the absolutely positioned background
 * layer can't paint over in-flow rows (the actual cause of the gaps).
 */
import { domMax, LazyMotion } from "framer-motion";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { MessageList } from "@/components/chat/MessageList";
import { SystemPill } from "@/components/chat/SystemPill";
import { SYSTEM_KINDS, systemLine, systemMessageData } from "@/lib/chat/systemKinds";
import { mediaLabel } from "@/lib/db/messages";
import type { Message } from "@/lib/types";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollTo = () => undefined;
Element.prototype.scrollIntoView = () => undefined;

const ME = "uid-me";
const FRIEND = "uid-friend";
const T0 = Date.UTC(2026, 9, 16, 9, 0, 0);
const META = { who: "Sam", pet: "Mochi", level: 3, game: "Chess", sticker: "sunflower", idea: "Bake together" };

/** The only system shape found by scripts/inspect-system-messages.mjs (37 of 290 messages). */
function legacySystem(id: string, text: string): Message {
  return {
    id,
    senderId: FRIEND,
    type: "system",
    text,
    status: "read",
    reactions: {},
    deliveredAt: null,
    readAt: null,
    deletedFor: [],
    deletedForEveryone: false,
    createdAt: null,
    createdAtMs: T0,
    pending: false,
  } as unknown as Message;
}

let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
});

function render(node: React.ReactNode): HTMLElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(<LazyMotion features={domMax}>{node}</LazyMotion>));
  cleanup = () => {
    act(() => root.unmount());
    host.remove();
  };
  return host;
}

describe("SystemPill", () => {
  it.each(SYSTEM_KINDS)("kind %s without text derives a visible line", (kind) => {
    const host = render(<SystemPill message={{ text: "", kind, meta: META }} />);
    const text = host.textContent?.trim() ?? "";
    expect(text.length).toBeGreaterThan(1);
    expect(text).not.toBe("✨");
  });

  it("kind lines survive missing meta", () => {
    for (const kind of SYSTEM_KINDS) expect(systemLine({ kind }).trim().length).toBeGreaterThan(1);
  });

  it("the legacy shape (type=system + text, no kind) shows its text", () => {
    const host = render(<SystemPill message={legacySystem("m1", "🌙 Sam went to sleep")} />);
    expect(host.textContent).toBe("🌙 Sam went to sleep");
  });

  it("an unknown kind, blank text or no fields at all falls back to ✨", () => {
    expect(systemLine({ kind: "laser-show", text: "   " })).toBe("✨");
    expect(systemLine({})).toBe("✨");
    expect(systemLine({ text: 42, meta: ["x"] })).toBe("✨");
    expect(render(<SystemPill message={{ text: "", kind: "laser-show" }} />).textContent).toBe("✨");
  });

  it("the writer's shape carries type, kind and text; the Home preview reads it", () => {
    const doc = systemMessageData(ME, "pet-fed", "🍪 Sam fed Mochi", { who: "Sam", pet: "Mochi" }, "ts");
    expect(doc).toMatchObject({ type: "system", kind: "pet-fed", text: "🍪 Sam fed Mochi", senderId: ME, createdAt: "ts" });
    expect(doc).not.toHaveProperty("readAt");
    expect(mediaLabel({ type: "system", text: "", deletedForEveryone: false, kind: "pet-fed", meta: { who: "Sam", pet: "Mochi" } })).toBe("🍪 Sam fed Mochi");
  });
});

describe("MessageList with system lines", () => {
  it("renders no empty row, and the scroller is positioned above the background layer", () => {
    const messages: Message[] = [
      { ...legacySystem("s1", "🎉 Mochi reached level 2!"), createdAtMs: T0 },
      { ...legacySystem("s2", ""), kind: "pet-fed", meta: { who: "Sam", pet: "Mochi" }, createdAtMs: T0 + 1000 },
      { ...legacySystem("s3", ""), kind: "from-the-future", createdAtMs: T0 + 2000 },
      { ...legacySystem("t1", "hello"), type: "text", senderId: ME, createdAtMs: T0 + 3000 },
    ];
    const noop = () => undefined;
    const host = render(
      <MessageList
        messages={messages}
        ready
        hasMore={false}
        loadingOlder={false}
        pageCount={1}
        loadOlder={noop}
        prune={() => false}
        uid={ME}
        tz="UTC"
        friendName="Sam"
        initialUnread={new Set(["s1", "s2", "s3"])}
        onOpenMenu={noop}
        onReply={noop}
        onReact={noop}
        onOpenImage={noop}
        deletingIds={new Set()}
        uploads={[]}
        onRetryUpload={noop}
        onDismissUpload={noop}
        layoutTick={0}
        backdrop={<div data-testid="backdrop" className="absolute inset-0" />}
      />,
    );

    const pills = [...host.querySelectorAll('[role="note"]')];
    expect(pills.map((p) => p.textContent)).toEqual(["🎉 Mochi reached level 2!", "🍪 Sam fed Mochi", "✨"]);

    const rows = [...(pills[0]?.parentElement?.parentElement?.children ?? [])];
    expect(rows).toHaveLength(4);
    for (const row of rows) expect(row.textContent?.trim().length).toBeGreaterThan(0);

    // System lines are never unread: no divider even though they were passed in as unread.
    expect(host.textContent).not.toMatch(/unread/);

    const backdrop = host.querySelector('[data-testid="backdrop"]');
    const scroller = backdrop?.nextElementSibling;
    expect(scroller?.contains(pills[0] ?? null)).toBe(true);
    expect(scroller?.className).toMatch(/\brelative\b/);
  });
});
