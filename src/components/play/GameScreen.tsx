"use client";

import { createContext, useContext, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";

const DockContext = createContext<HTMLDivElement | null>(null);

/**
 * The game layout: a header, a content area that takes the rest of the
 * viewport (boards scale into it through the `board` utility's `--board-fit`),
 * and a dock pinned above the tab bar. The whole thing fills `<main>` (the
 * shell's only scroller) exactly, so the page never scrolls: only the content
 * area does, and only when it truly doesn't fit. Keyboards, option and vote
 * buttons, inputs and the reaction row live in the dock, either through the
 * `dock` prop or from anywhere inside the content with `<Dock>`.
 */
export function GameScreen({ header, children, dock, contentClassName }: { header: React.ReactNode; children: React.ReactNode; dock?: React.ReactNode; contentClassName?: string }) {
  const [dockEl, setDockEl] = useState<HTMLDivElement | null>(null);
  return (
    <div className="-mb-6 flex min-h-0 flex-1 flex-col" data-game-screen>
      <div className="flex shrink-0 flex-col gap-3">{header}</div>
      <DockContext.Provider value={dockEl}>
        <div className={cn("game-content -mx-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain px-4 py-3", contentClassName)} data-game-content>
          {children}
        </div>
      </DockContext.Provider>
      <div ref={setDockEl} className="flex shrink-0 flex-col gap-2 pt-1 pb-2 empty:hidden" data-game-dock>
        {dock}
      </div>
    </div>
  );
}

/** Renders its children in the enclosing GameScreen's dock, keeping state where it belongs. */
export function Dock({ children }: { children: React.ReactNode }) {
  const el = useContext(DockContext);
  return el ? createPortal(children, el) : null;
}
