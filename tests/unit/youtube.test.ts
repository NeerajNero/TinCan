// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { syncPlan } from "@/lib/playerSync";
import { loadYouTubeApi, resetYouTubeApiForTests, YT_API_SRC, YT_STATE, youTubeErrorMessage, type YTNamespace } from "@/lib/youtube";

const fakeYT = { Player: vi.fn(), PlayerState: {} } as unknown as YTNamespace;

describe("loadYouTubeApi", () => {
  beforeEach(() => {
    resetYouTubeApiForTests();
    delete window.YT;
    delete window.onYouTubeIframeAPIReady;
    document.head.replaceChildren();
  });
  afterEach(() => resetYouTubeApiForTests());

  it("resolves immediately when YT.Player already exists, without adding a script", async () => {
    window.YT = fakeYT;
    await expect(loadYouTubeApi()).resolves.toBe(fakeYT);
    expect(document.querySelectorAll("script").length).toBe(0);
  });

  it("adds the script once and wraps an existing ready handler", async () => {
    const existing = vi.fn();
    window.onYouTubeIframeAPIReady = existing;
    // Keep happy-dom from fetching (and failing) the real script.
    const append = vi.spyOn(document.head, "appendChild").mockImplementation((n) => n);
    const a = loadYouTubeApi();
    const b = loadYouTubeApi();
    expect(a).toBe(b);
    expect(append).toHaveBeenCalledOnce();
    expect((append.mock.calls[0]?.[0] as HTMLScriptElement).src).toBe(YT_API_SRC);
    append.mockRestore();
    window.YT = fakeYT;
    window.onYouTubeIframeAPIReady?.();
    await expect(a).resolves.toBe(fakeYT);
    expect(existing).toHaveBeenCalledOnce();
  });

  it("reuses a script tag someone else added", async () => {
    const s = document.createElement("script");
    s.src = YT_API_SRC;
    document.head.appendChild(s);
    const p = loadYouTubeApi();
    expect(document.querySelectorAll("script").length).toBe(1);
    window.YT = fakeYT;
    window.onYouTubeIframeAPIReady?.();
    await expect(p).resolves.toBe(fakeYT);
  });
});

describe("youTubeErrorMessage", () => {
  it("explains embedding refusals", () => {
    expect(youTubeErrorMessage(101)).toMatch(/can't be embedded/);
    expect(youTubeErrorMessage(150)).toMatch(/can't be embedded/);
    expect(youTubeErrorMessage(100)).toMatch(/removed or is private/);
    expect(youTubeErrorMessage(999)).toMatch(/couldn't play/);
  });
});

describe("syncPlan", () => {
  const node = { playing: true, positionSec: 10, updatedAt: 1_000 };
  it("plays and seeks when the shared playhead moved on", () => {
    expect(syncPlan(node, 6_000, { time: 0, state: YT_STATE.CUED })).toEqual({ seekTo: 15, action: "play" });
  });
  it("leaves a client within the drift window alone", () => {
    expect(syncPlan(node, 6_000, { time: 14, state: YT_STATE.PLAYING })).toEqual({ seekTo: null, action: null });
  });
  it("pauses at the stored position", () => {
    expect(syncPlan({ ...node, playing: false }, 99_000, { time: 30, state: YT_STATE.PLAYING })).toEqual({ seekTo: 10, action: "pause" });
  });
});
