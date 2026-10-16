// @vitest-environment happy-dom
/** First visit auto-opens the sheet; "Got it" remembers it; the ? reopens it; reset brings it back. */
import { domMax, LazyMotion, MotionGlobalConfig } from "framer-motion";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { HowToButton } from "@/components/ui/HowTo";
import { resetHowToSeen } from "@/hooks/useHowToSeen";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// happy-dom's Web Animations reject on cancel; the behaviour under test doesn't need motion.
MotionGlobalConfig.skipAnimations = true;

let root: Root;
let host: HTMLDivElement;
const dialog = () => document.querySelector('[role="dialog"]');
const render = (autoOpen = true) =>
  act(() =>
    root.render(
      <LazyMotion features={domMax}>
        <HowToButton topic="pictionary" autoOpen={autoOpen} />
      </LazyMotion>,
    ),
  );
const click = (el: Element | null) => act(() => (el as HTMLElement).click());
const gotIt = () => [...document.querySelectorAll("button")].find((b) => b.textContent === "Got it") ?? null;

beforeEach(() => {
  localStorage.clear();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("HowToButton", () => {
  it("opens by itself on the first visit and not after Got it", () => {
    render();
    expect(dialog()?.textContent).toContain("How Pictionary works");
    expect(dialog()?.textContent).toContain("One of you draws, the other guesses");
    click(gotIt());
    expect(JSON.parse(localStorage.getItem("tincan-howto-seen") ?? "[]")).toContain("pictionary");
    act(() => root.unmount());
    root = createRoot(host);
    render();
    expect(gotIt()).toBeNull();
  });

  it("opens from the ? button, and cards never auto-open", () => {
    render(false);
    expect(gotIt()).toBeNull();
    click(host.querySelector('button[aria-label="How Pictionary works"]'));
    expect(gotIt()).not.toBeNull();
  });

  it("Show all tips again brings the first-visit sheet back", () => {
    localStorage.setItem("tincan-howto-seen", JSON.stringify(["pictionary"]));
    render();
    expect(gotIt()).toBeNull();
    act(() => resetHowToSeen());
    act(() => root.unmount());
    root = createRoot(host);
    render();
    expect(gotIt()).not.toBeNull();
  });
});
