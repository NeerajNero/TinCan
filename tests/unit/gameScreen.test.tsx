// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Dock, GameScreen } from "@/components/play/GameScreen";
import { Pressable } from "@/components/ui/Pressable";

describe("GameScreen composite", () => {
  it("renders header, content and dock, and <Dock> from inside the content lands in the dock", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <GameScreen header={<h1>Daily word</h1>} dock={<button type="button">Enter</button>}>
          <p>board</p>
          <Dock>
            <button type="button">From inside</button>
          </Dock>
        </GameScreen>,
      );
    });
    await act(async () => {});
    const dock = host.querySelector("[data-game-dock]")!;
    const content = host.querySelector("[data-game-content]")!;
    expect(host.querySelector("h1")?.textContent).toBe("Daily word");
    expect(content.textContent).toContain("board");
    expect(content.querySelector("button")).toBeNull();
    expect(Array.from(dock.querySelectorAll("button")).map((b) => b.textContent)).toEqual(["Enter", "From inside"]);
    act(() => root.unmount());
    host.remove();
  });
});

describe("Pressable", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("buzzes 10 ms on press and gives nothing when disabled", async () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { ...navigator, vibrate });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const onClick = vi.fn();
    await act(async () => {
      root.render(
        <>
          <Pressable onClick={onClick}>a</Pressable>
          <Pressable disabled onClick={onClick}>
            b
          </Pressable>
        </>,
      );
    });
    const [a, b] = Array.from(host.querySelectorAll("button"));
    expect(a?.className).toContain("pressable");
    expect(b?.disabled).toBe(true);
    await act(async () => {
      a?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      a?.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      a?.click();
    });
    expect(vibrate).toHaveBeenCalledWith(10);
    expect(onClick).toHaveBeenCalledTimes(1);
    vibrate.mockClear();
    await act(async () => {
      b?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      b?.click();
    });
    expect(vibrate).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    host.remove();
  });
});
