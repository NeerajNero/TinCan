/**
 * Chat list render cost. Mounts <MessageList> with 300 messages inside
 * React's <Profiler>, then appends one message at a time and records the
 * commit's `actualDuration`. happy-dom is slower than a phone's Chrome, so treat
 * the numbers as an upper bound; the point is the *shape*: an append must not
 * re-render the 300 existing bubbles (React.memo + stable props).
 */
import { domMax, LazyMotion } from "framer-motion";
import { act, Profiler, type ProfilerOnRenderCallback } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { MessageList } from "@/components/chat/MessageList";
import type { Message } from "@/lib/types";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// happy-dom has no layout: stub what the list calls.
Element.prototype.scrollTo = () => undefined;
Element.prototype.scrollIntoView = () => undefined;

const ME = "uid-me";
const FRIEND = "uid-friend";
const T0 = Date.UTC(2026, 9, 16, 9, 0, 0);

function message(i: number): Message {
  const mine = i % 2 === 0;
  return {
    id: `m${i}`,
    senderId: mine ? ME : FRIEND,
    type: "text",
    text: `Message number ${i} — ${"lorem ipsum ".repeat((i % 5) + 1)}`,
    media: null,
    replyTo: i % 7 === 0 && i > 0 ? { id: `m${i - 1}`, preview: "earlier", senderId: FRIEND, type: "text" } : null,
    reactions: i % 9 === 0 ? { [FRIEND]: "❤️" } : {},
    status: "read",
    deliveredAt: null,
    readAt: null,
    editedAt: null,
    deletedFor: [],
    deletedForEveryone: false,
    createdAt: null,
    createdAtMs: T0 + i * 60_000,
    pending: false,
  } as unknown as Message;
}

const noop = () => undefined;

function mount(messages: Message[], onRender: ProfilerOnRenderCallback): { root: Root; render: (next: Message[]) => void } {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const render = (next: Message[]) =>
    act(() => {
      root.render(
        <LazyMotion features={domMax}>
          <Profiler id="chat" onRender={onRender}>
            <MessageList
              messages={next}
              ready
              hasMore={false}
              loadingOlder={false}
              pageCount={1}
              loadOlder={noop}
              prune={() => false}
              uid={ME}
              tz="Asia/Kolkata"
              friendName="Friend"
              initialUnread={new Set()}
              onOpenMenu={noop}
              onReply={noop}
              onReact={noop}
              onOpenImage={noop}
              deletingIds={new Set()}
              uploads={[]}
              onRetryUpload={noop}
              onDismissUpload={noop}
              layoutTick={0}
            />
          </Profiler>
        </LazyMotion>,
      );
    });
  render(messages);
  return { root, render };
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;

describe("chat list profile", () => {
  it("appending one message to a 300-message thread costs far less than the initial mount", () => {
    const commits: Array<{ phase: string; actual: number }> = [];
    const onRender: ProfilerOnRenderCallback = (_id, phase, actualDuration) => commits.push({ phase, actual: actualDuration });

    let list = Array.from({ length: 300 }, (_, i) => message(i));
    const { root, render } = mount(list, onRender);
    const mountCommit = commits.find((c) => c.phase === "mount")?.actual ?? 0;

    const appends: number[] = [];
    for (let i = 0; i < 10; i++) {
      commits.length = 0;
      list = [...list, message(300 + i)];
      render(list);
      appends.push(commits.filter((c) => c.phase === "update").reduce((a, c) => a + c.actual, 0));
    }
    act(() => root.unmount());

    const med = median(appends);
    console.info(`[profile] mount 300 messages: ${mountCommit.toFixed(1)} ms; append ×10 median: ${med.toFixed(2)} ms (min ${Math.min(...appends).toFixed(2)}, max ${Math.max(...appends).toFixed(2)}); per-bubble mount ≈ ${(mountCommit / 300).toFixed(2)} ms`);

    expect(mountCommit).toBeGreaterThan(0);
    // The memoised bubbles mean an append costs a few bubbles' worth, not 300.
    expect(med).toBeLessThan(mountCommit / 4);
  });
});
