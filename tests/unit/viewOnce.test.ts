import { describe, expect, it } from "vitest";

import { isOnceRequest, ONCE_PARAM, onceUrl, onceVariants, viewOnceLabel, viewOnceState } from "@/lib/viewOnce";

const url = "https://res.cloudinary.com/demo/image/authenticated/s--AbCd_12---/w_320/tincan/images/a";
const base = { senderId: "me", media: { url, publicId: "tincan/images/a" } };

describe("view-once: URL marker", () => {
  it("appends once=1 exactly once and the worker recognises it", () => {
    expect(onceUrl(url)).toBe(`${url}?${ONCE_PARAM}=1`);
    expect(onceUrl(onceUrl(url))).toBe(`${url}?once=1`);
    expect(onceUrl(`${url}?x=1`)).toBe(`${url}?x=1&once=1`);
    expect(isOnceRequest(new URL(onceUrl(url)))).toBe(true);
    expect(isOnceRequest(new URL(url))).toBe(false);
    expect(isOnceRequest(new URL(`${url}?once=2`))).toBe(false);
  });
  it("marks every stored variant", () => {
    const v = onceVariants({ w320: url, w800: `${url}800`, blur: undefined });
    expect(v).toEqual({ w320: `${url}?once=1`, w800: `${url}800?once=1` });
    expect(onceVariants(undefined)).toBeUndefined();
  });
});

describe("view-once: state machine", () => {
  it("plain unless flagged; sealed for the recipient, 'not opened yet' for the sender; opened once viewed or cleared", () => {
    expect(viewOnceState({ ...base }, "them")).toBe("plain");
    expect(viewOnceState({ ...base, viewOnce: false }, "them")).toBe("plain");
    expect(viewOnceState({ ...base, viewOnce: true, viewedAt: null }, "them")).toBe("sealed-theirs");
    expect(viewOnceState({ ...base, viewOnce: true, viewedAt: null }, "me")).toBe("sealed-mine");
    const viewed = { toMillis: () => 1, toDate: () => new Date(1) } as unknown as NonNullable<Parameters<typeof viewOnceState>[0]["viewedAt"]>;
    expect(viewOnceState({ ...base, viewOnce: true, viewedAt: viewed }, "them")).toBe("opened");
    expect(viewOnceState({ ...base, viewOnce: true, viewedAt: viewed }, "me")).toBe("opened");
    // The server cleared the asset but the stamp hasn't arrived yet: still opened, never re-openable.
    expect(viewOnceState({ ...base, media: null, viewOnce: true, viewedAt: null }, "them")).toBe("opened");
  });
  it("labels", () => {
    expect(viewOnceLabel("image", "sealed-theirs", null)).toBe("👁️ Photo · tap to view once");
    expect(viewOnceLabel("voice", "sealed-theirs", null)).toBe("👁️ Voice note · tap to play once");
    expect(viewOnceLabel("image", "sealed-mine", null)).toBe("👁️ View once · not opened yet");
    expect(viewOnceLabel("image", "opened", null)).toBe("👁️ Opened");
    expect(viewOnceLabel("voice", "opened", "9:14 PM")).toBe("👁️ Opened at 9:14 PM");
    expect(viewOnceLabel("image", "plain", null)).toBe("");
  });
});
