/**
 * Phase 28: the notifications inbox's pure parts — the bell badge, the
 * server's burst-collapse rule, the unread dot and the only write the owner
 * makes to `users/{me}.inbox` (zero + stamp).
 */
import { describe, expect, it } from "vitest";

import { formatBadge, INBOX_BADGE_MAX, INBOX_BURST_MS, INBOX_EMOJI, inboxItemUnread, inboxRecords, inboxUnread, markReadPatch, shouldCollapse } from "@/lib/inbox";
import { PUSH_TYPES } from "@/lib/pushTypes";

const ts = (ms: number) => ({ toMillis: () => ms });

describe("formatBadge", () => {
  it("is hidden at zero, missing or nonsense", () => {
    expect(formatBadge(0)).toBe("");
    expect(formatBadge(-3)).toBe("");
    expect(formatBadge(null)).toBe("");
    expect(formatBadge(undefined)).toBe("");
    expect(formatBadge(Number.NaN)).toBe("");
  });
  it("shows the count up to 99 and caps at 99+", () => {
    expect(formatBadge(1)).toBe("1");
    expect(formatBadge(42)).toBe("42");
    expect(formatBadge(INBOX_BADGE_MAX)).toBe("99");
    expect(formatBadge(100)).toBe("99+");
    expect(formatBadge(1234)).toBe("99+");
  });
  it("reads the count off the user doc, tolerating a missing map", () => {
    expect(inboxUnread({ inbox: { unread: 5 } })).toBe(5);
    expect(inboxUnread({ inbox: null })).toBe(0);
    expect(inboxUnread({})).toBe(0);
    expect(inboxUnread(null)).toBe(0);
  });
});

describe("markReadPatch", () => {
  it("zeroes the count and stamps lastReadAt with the sentinel it is given", () => {
    const sentinel = { kind: "serverTimestamp" };
    expect(markReadPatch(sentinel)).toEqual({ "inbox.unread": 0, "inbox.lastReadAt": sentinel });
  });
});

describe("shouldCollapse", () => {
  const now = Date.UTC(2026, 10, 2, 12, 0, 0);
  it("folds a bursty type into the latest unread row within the window", () => {
    expect(shouldCollapse({ type: "message", createdAtMs: now - 60_000 }, "message", now, null)).toBe(true);
    expect(shouldCollapse({ type: "ping", createdAtMs: now - 5 * 60_000 }, "ping", now, now - 60 * 60_000)).toBe(true);
  });
  it("never folds a different type, a read row, an old row or a non-bursty type", () => {
    expect(shouldCollapse(null, "message", now, null)).toBe(false);
    expect(shouldCollapse({ type: "ping", createdAtMs: now - 60_000 }, "message", now, null)).toBe(false);
    expect(shouldCollapse({ type: "message", createdAtMs: now - 60_000 }, "message", now, now - 30_000)).toBe(false);
    expect(shouldCollapse({ type: "message", createdAtMs: now - INBOX_BURST_MS }, "message", now, null)).toBe(false);
    expect(shouldCollapse({ type: "milestone", createdAtMs: now - 60_000 }, "milestone", now, null)).toBe(false);
    expect(shouldCollapse({ type: "jar", createdAtMs: now - 60_000 }, "jar", now, null)).toBe(false);
  });
});

describe("rows", () => {
  it("a row is unread while newer than the stamp the sheet opened with; a pending timestamp counts as new", () => {
    expect(inboxItemUnread({ createdAt: ts(2000) }, 1000)).toBe(true);
    expect(inboxItemUnread({ createdAt: ts(1000) }, 1000)).toBe(false);
    expect(inboxItemUnread({ createdAt: ts(500) }, 1000)).toBe(false);
    expect(inboxItemUnread({ createdAt: null }, 1000)).toBe(true);
    expect(inboxItemUnread({ createdAt: ts(5) }, null)).toBe(true);
  });
  it("every push type has a glyph; only the test button and the digest skip the inbox", () => {
    for (const t of PUSH_TYPES) expect(INBOX_EMOJI[t]).toBeTruthy();
    expect(PUSH_TYPES.filter((t) => !inboxRecords(t))).toEqual(["test", "digest"]);
  });
});
