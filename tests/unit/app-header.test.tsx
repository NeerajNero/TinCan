// @vitest-environment happy-dom
/**
 * Chore "persistent app header": pages declare their header with `useHeader`;
 * the provider keeps the last declaration through unmounts (so navigation and
 * `loading.tsx` never blank the header) until the next page declares, and the
 * header renders the three slots from it.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: () => undefined, replace: () => undefined, push: () => undefined }),
  usePathname: () => "/",
}));

import { AppHeader } from "@/components/app-header";
import { HeaderProvider, useHeader } from "@/components/shell/HeaderProvider";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function PageA() {
  useHeader({ emoji: "🥫", title: "Hi, Sam" });
  return <p>A</p>;
}
function PageB() {
  useHeader({ emoji: "📸", title: "Photos", back: "/memories", subtitle: "Priya is here", actions: <button type="button">Sync</button> });
  return <p>B</p>;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;
function mount(page: "a" | "b" | null) {
  if (!root) {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  }
  act(() => {
    root!.render(
      <HeaderProvider>
        <AppHeader bell={<span data-bell>bell</span>} />
        <main>{page === "a" ? <PageA /> : page === "b" ? <PageB /> : null}</main>
      </HeaderProvider>,
    );
  });
}
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

const h1 = () => document.querySelector("[data-app-header] h1")!.textContent;

describe("persistent app header", () => {
  it("renders what the page declared and keeps it after the page unmounts", () => {
    mount("a");
    expect(h1()).toBe("Hi, Sam");
    expect(document.querySelector('[data-app-header] [aria-label="Back"]')).toBeNull();
    expect(document.querySelector("[data-bell]")).not.toBeNull();
    mount(null); // a loading.tsx moment: no page in the tree
    expect(h1()).toBe("Hi, Sam");
  });

  it("switches to the next page's declaration, with back, subtitle and actions", () => {
    mount("a");
    mount("b");
    expect(h1()).toBe("Photos");
    expect(document.querySelector('[data-app-header] [aria-label="Back"]')).not.toBeNull();
    expect(document.querySelector("[data-app-header]")!.textContent).toContain("Priya is here");
    expect(document.querySelector("[data-app-header] button[type=button]:not([aria-label])")!.textContent).toBe("Sync");
    mount("a");
    expect(h1()).toBe("Hi, Sam");
    expect(document.querySelector('[data-app-header] [aria-label="Back"]')).toBeNull();
  });
});
