import { describe, expect, it } from "vitest";

import { classifyShare, extractUrl, isShareId, sameOriginPath, shareChatText, shareFileKey, shareMetaKey } from "@/lib/share";

const meta = (over: Partial<{ title: string; text: string; url: string; files: Array<{ type: string }> }> = {}) => ({ title: "", text: "", url: "", files: [], ...over });

describe("share target", () => {
  it("classifies a YouTube link from the url or the text field", () => {
    const a = classifyShare(meta({ url: "https://youtu.be/dQw4w9WgXcQ", title: "Never Gonna Give You Up" }));
    expect(a).toMatchObject({ kind: "youtube", videoId: "dQw4w9WgXcQ", title: "Never Gonna Give You Up" });
    const b = classifyShare(meta({ text: "Watch this! https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share" }));
    expect(b.kind).toBe("youtube");
    expect(b.videoId).toBe("dQw4w9WgXcQ");
  });

  it("classifies other links, plain text, images and nothing", () => {
    expect(classifyShare(meta({ text: "Look: https://example.com/a-page." }))).toMatchObject({ kind: "link", url: "https://example.com/a-page", videoId: null });
    expect(classifyShare(meta({ text: "just words" })).kind).toBe("text");
    expect(classifyShare(meta({ title: "only a title" })).kind).toBe("text");
    expect(classifyShare(meta({ files: [{ type: "image/jpeg" }], text: "with a caption" })).kind).toBe("images");
    expect(classifyShare(meta({ files: [{ type: "application/pdf" }] })).kind).toBe("empty");
    expect(classifyShare(meta()).kind).toBe("empty");
  });

  it("extracts the first http(s) link and strips trailing punctuation", () => {
    expect(extractUrl("see https://example.com/x?y=1, then more")).toBe("https://example.com/x?y=1");
    expect(extractUrl("ftp://nope and nothing")).toBeNull();
    expect(extractUrl("")).toBeNull();
  });

  it("builds the chat text from title, text and link without repeating any", () => {
    expect(shareChatText({ title: "A page", text: "A page", url: "https://example.com" })).toBe("A page\nhttps://example.com");
    expect(shareChatText({ title: "", text: "Watch https://example.com", url: "https://example.com" })).toBe("Watch https://example.com");
    expect(shareChatText({ title: "x".repeat(3000), text: "", url: null })).toHaveLength(2000);
  });

  it("keys the stash by a nonce and accepts only safe ids", () => {
    expect(shareMetaKey("abc-123-def")).toBe("/share-stash/abc-123-def");
    expect(shareFileKey("abc-123-def", 2)).toBe("/share-stash/abc-123-def/file/2");
    expect(isShareId("7f9c1e2a-3b4d-4c5e-8f6a-1b2c3d4e5f60")).toBe(true);
    expect(isShareId("../etc")).toBe(false);
    expect(isShareId("short")).toBe(false);
    expect(isShareId(null)).toBe(false);
  });

  it("only follows a same-origin `next` path after sign-in", () => {
    expect(sameOriginPath("/share?id=abc-123-def")).toBe("/share?id=abc-123-def");
    expect(sameOriginPath("//evil.example/share")).toBeNull();
    expect(sameOriginPath("https://evil.example/")).toBeNull();
    expect(sameOriginPath("/\\evil")).toBeNull();
    expect(sameOriginPath("")).toBeNull();
    expect(sameOriginPath(null)).toBeNull();
  });
});
