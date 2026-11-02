// @vitest-environment happy-dom
/**
 * Chore "view-once toggle placement": the 👁️ toggle lives inside the attachment
 * preview, so a text-only composer never shows it; it appears with picked
 * photos and with a recorded (not yet sent) voice note, defaults to off, is
 * icon-only in both states (the filled background says "on"), and resets after
 * each send.
 */
import { domMax, LazyMotion, MotionGlobalConfig } from "framer-motion";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useTyping", () => ({ useTypingWriter: () => ({ ping: () => undefined, clear: () => undefined }) }));
vi.mock("@/lib/media/recorder", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/media/recorder")>();
  class FakeRecorder {
    elapsedMs = 2000;
    start(): Promise<void> {
      return Promise.resolve();
    }
    stop(): Promise<{ blob: Blob; durationMs: number; mimeType: string }> {
      return Promise.resolve({ blob: new Blob(["x"]), durationMs: 2000, mimeType: "audio/webm" });
    }
    cancel(): void {}
  }
  return { ...actual, recordingSupported: () => true, VoiceRecorder: FakeRecorder };
});

import { Composer } from "@/components/chat/Composer";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
MotionGlobalConfig.skipAnimations = true;
URL.createObjectURL = () => "blob:local";
URL.revokeObjectURL = () => undefined;
HTMLElement.prototype.setPointerCapture = () => undefined;

const onSendImages = vi.fn();
const onSendVoice = vi.fn();
const noop = () => undefined;
const asyncNoop = () => Promise.resolve();

let root: Root | null = null;
let host: HTMLDivElement | null = null;
function mount() {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <LazyMotion features={domMax} strict>
        <Composer
          uid="me"
          friendName="Sam"
          replyTo={null}
          editing={null}
          onCancelReply={noop}
          onCancelEdit={noop}
          onSend={asyncNoop}
          onSaveEdit={asyncNoop}
          onSendImages={onSendImages}
          onSendVoice={onSendVoice}
          onSendSticker={noop}
          onSendGif={noop}
          onSchedule={noop}
        />
      </LazyMotion>,
    );
  });
}
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  onSendImages.mockClear();
  onSendVoice.mockClear();
});

const toggle = () => document.querySelector<HTMLButtonElement>('[data-testid="view-once-toggle"]');
const q = <T extends Element>(sel: string) => document.querySelector<T>(sel)!;
const flush = () => act(async () => Promise.resolve());

function pickPhoto() {
  const input = q<HTMLInputElement>('input[type="file"]');
  Object.defineProperty(input, "files", { value: [new File(["x"], "a.png", { type: "image/png" })], configurable: true });
  act(() => void input.dispatchEvent(new Event("change", { bubbles: true })));
}

function typeText(value: string) {
  const ta = q<HTMLTextAreaElement>('textarea[aria-label="Message"]');
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  act(() => {
    setter.call(ta, value);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("view-once toggle placement", () => {
  it("is absent with text only, even while the mic is showing", () => {
    mount();
    expect(toggle()).toBeNull();
    expect(q('[aria-label="Hold to record a voice note"]')).toBeTruthy();
    typeText("hello");
    expect(toggle()).toBeNull();
  });

  it("appears next to a picked photo, off by default, and resets after the send", async () => {
    mount();
    pickPhoto();
    const t = toggle();
    expect(t).not.toBeNull();
    expect(t!.getAttribute("aria-pressed")).toBe("false");
    expect(t!.textContent).toBe("");
    act(() => t!.click());
    expect(toggle()!.getAttribute("aria-pressed")).toBe("true");
    expect(toggle()!.textContent).toBe(""); // icon only in both states
    expect(toggle()!.getAttribute("title")).toBe("View once: on");
    await act(async () => q<HTMLButtonElement>('button[aria-label="Send"]').click());
    await flush();
    expect(onSendImages).toHaveBeenCalledTimes(1);
    expect(onSendImages.mock.calls[0]![2]).toBe(true);
    expect(toggle()).toBeNull();
    // The next photo starts off again.
    pickPhoto();
    expect(toggle()!.getAttribute("aria-pressed")).toBe("false");
  });

  it("appears next to a recorded voice note and resets after it is sent", async () => {
    mount();
    const mic = q<HTMLButtonElement>('[aria-label="Hold to record a voice note"]');
    await act(async () => {
      mic.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: 100 }));
    });
    await flush();
    await act(async () => {
      q('[aria-label="Release to send voice note"]').dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, clientX: 100 }));
    });
    await flush();
    expect(q('[data-testid="voice-preview"]')).toBeTruthy();
    expect(onSendVoice).not.toHaveBeenCalled();
    const t = toggle();
    expect(t).not.toBeNull();
    expect(t!.getAttribute("aria-pressed")).toBe("false");
    act(() => t!.click());
    expect(toggle()!.getAttribute("aria-pressed")).toBe("true");
    act(() => q<HTMLButtonElement>('button[aria-label="Send voice note"]').click());
    expect(onSendVoice).toHaveBeenCalledTimes(1);
    expect(onSendVoice.mock.calls[0]![0]).toMatchObject({ durationMs: 2000 });
    expect(onSendVoice.mock.calls[0]![1]).toBe(true);
    expect(document.querySelector('[data-testid="voice-preview"]')).toBeNull();
    expect(toggle()).toBeNull();
  });
});
