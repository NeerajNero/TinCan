"use client";

import { useState } from "react";

import { AppHeader } from "@/components/app-header";
import { BellButton } from "@/components/shell/BellButton";
import { HeaderProvider, useHeader } from "@/components/shell/HeaderProvider";

/**
 * Test-only: the persistent app header inside a stand-in shell (fixed column,
 * header first, `<main>` as the scroller, a tab-bar-sized last row) with two
 * fake tabs that declare different header content and a badge counter, so
 * Playwright can check the header's box never moves across a tab switch or a
 * badge change. No sign-in, no Firebase: the bell is the shared `BellButton`.
 */
export function HeaderHarness() {
  const [tab, setTab] = useState<"a" | "b">("a");
  const [unread, setUnread] = useState(0);
  return (
    <HeaderProvider>
      <div className="fixed inset-0 mx-auto flex w-full max-w-[480px] flex-col">
        <AppHeader bell={<BellButton unread={unread} onClick={() => setUnread(0)} />} />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-4 pb-6" data-main>
          {tab === "a" ? <TabA /> : <TabB />}
        </main>
        <div className="flex h-[76px] shrink-0 items-center justify-center gap-2" data-tabbar>
          <button type="button" data-tab="a" onClick={() => setTab("a")} className="rounded-full bg-surface-2 px-3 py-2 text-sm font-bold">
            Tab A
          </button>
          <button type="button" data-tab="b" onClick={() => setTab("b")} className="rounded-full bg-surface-2 px-3 py-2 text-sm font-bold">
            Tab B
          </button>
          <button type="button" data-badge-bump onClick={() => setUnread((n) => n + 1)} className="rounded-full bg-surface-2 px-3 py-2 text-sm font-bold">
            +1
          </button>
          <button type="button" data-badge-many onClick={() => setUnread(150)} className="rounded-full bg-surface-2 px-3 py-2 text-sm font-bold">
            99+
          </button>
        </div>
      </div>
    </HeaderProvider>
  );
}

function TabA() {
  useHeader({ emoji: "🥫", title: "Hi, Sam", help: "play" });
  return <p data-content="a">Tab A content</p>;
}

function TabB() {
  useHeader({ emoji: "📸", title: "A much longer title that must truncate instead of growing the bar", subtitle: "Priya is here", back: "/", actions: <span className="px-2 text-xs">Sync</span> });
  return <p data-content="b">Tab B content</p>;
}
