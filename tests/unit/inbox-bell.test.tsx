// @vitest-environment happy-dom
/**
 * Phase 28: the header bell. The badge comes from `users/{me}.inbox.unread`
 * (hidden at zero, capped at 99+) and opening the sheet zeroes it by writing
 * `markInboxRead(uid)`; a bell with nothing unread opens without a write.
 */
import { domMax, LazyMotion, MotionGlobalConfig } from "framer-motion";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const markInboxRead = vi.fn<(uid: string) => Promise<void>>(() => Promise.resolve());
vi.mock("@/lib/db/inbox", () => ({
  markInboxRead: (uid: string) => markInboxRead(uid),
  deleteInboxItem: () => Promise.resolve(),
  // No query → the paged hook attaches nothing (no Firestore in unit tests).
  inboxQuery: () => null,
}));

let meInbox: { unread: number; lastReadAt: null } | undefined;
vi.mock("@/hooks/usePair", () => ({
  usePair: () => ({ uid: "uid-me", me: { nickname: "Me", inbox: meInbox }, friend: null, friendUid: null, pair: {}, loading: false }),
}));

import { InboxBell } from "@/components/shell/InboxBell";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// happy-dom's WAAPI rejects `finished` when a sheet unmounts mid-animation; instant animations keep the run clean.
MotionGlobalConfig.skipAnimations = true;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function mount(unread: number | undefined) {
  meInbox = unread === undefined ? undefined : { unread, lastReadAt: null };
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <LazyMotion features={domMax} strict>
        <InboxBell />
      </LazyMotion>,
    );
  });
}

beforeEach(() => markInboxRead.mockClear());
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

const bell = () => document.querySelector<HTMLButtonElement>('button[aria-label^="Notifications"]')!;
const badge = () => document.querySelector('[data-testid="inbox-badge"]');

describe("InboxBell", () => {
  it("hides the badge at zero and caps it at 99+", () => {
    mount(0);
    expect(badge()).toBeNull();
    expect(bell().getAttribute("aria-label")).toBe("Notifications");
    act(() => root?.unmount());
    mount(7);
    expect(badge()?.textContent).toBe("7");
    expect(bell().getAttribute("aria-label")).toBe("Notifications, 7 unread");
    act(() => root?.unmount());
    mount(250);
    expect(badge()?.textContent).toBe("99+");
  });

  it("opening the sheet zeroes the unread count", () => {
    mount(3);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    act(() => bell().click());
    expect(markInboxRead).toHaveBeenCalledTimes(1);
    expect(markInboxRead).toHaveBeenCalledWith("uid-me");
    const dialog = document.querySelector('[role="dialog"][aria-label="Notifications"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain("Mark all read");
  });

  it("opens without a write when nothing is unread", () => {
    mount(undefined);
    act(() => bell().click());
    expect(markInboxRead).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"][aria-label="Notifications"]')).not.toBeNull();
  });
});
