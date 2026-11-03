"use client";

import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { ChevronDown, Keyboard } from "lucide-react";
import { createContext, useContext, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Pressable } from "@/components/ui/Pressable";
import { cn } from "@/lib/cn";
import { dockCollapsed, rememberDock, type DockCollapsible } from "@/lib/dock";

interface DockContextValue {
  el: HTMLDivElement | null;
  setCollapsible: (c: DockCollapsible | null) => void;
}

const DockContext = createContext<DockContextValue>({ el: null, setCollapsible: () => undefined });

const SPRING = { type: "spring", duration: 0.2, bounce: 0 } as const;
const FADE = { duration: 0.2 } as const;

/**
 * The game layout: an optional pinned strip (the page header itself lives in
 * the persistent app header, declared with `useHeader` / `SubHeader`; the
 * strip is for a board game's seats card), a content area that takes the rest
 * of the viewport (boards scale into it through the `board` utility's
 * `--board-fit`), and a dock pinned above the tab bar. The whole thing fills `<main>` (the
 * shell's only scroller) exactly, so the page never scrolls: only the content
 * area does, and only when it truly doesn't fit. Keyboards, option and vote
 * buttons, inputs and the reaction row live in the dock, either through the
 * `dock` prop or from anywhere inside the content with `<Dock>`.
 *
 * A dock holding a letter keyboard is collapsible (`collapsible` here or on
 * `<Dock>`): a chevron in its top-right corner slides it down and out (spring,
 * 200 ms; a fade under reduced motion), the content area takes the freed
 * height, and a round floating keyboard button bottom-right (12 px above the
 * tab bar) brings it back. `lib/dock` holds the defaults and the session memory.
 */
export function GameScreen({ header, children, dock, collapsible, contentClassName }: { header?: React.ReactNode; children: React.ReactNode; dock?: React.ReactNode; collapsible?: DockCollapsible; contentClassName?: string }) {
  const reduce = useReducedMotion();
  const [dockEl, setDockEl] = useState<HTMLDivElement | null>(null);
  const [portalCollapsible, setPortalCollapsible] = useState<DockCollapsible | null>(null);
  const cfg = collapsible ?? portalCollapsible;
  const hasDock = dock !== undefined || portalCollapsible !== null;

  // Derived during render (no flash): the round state decides the default, a transition overrides the remembered choice.
  const signature = cfg ? `${cfg.key}:${cfg.roundActive}` : "";
  const [seen, setSeen] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  if (signature !== seen) {
    setSeen(signature);
    setCollapsed(cfg ? dockCollapsed(cfg.key, cfg.roundActive) : false);
  }
  const toggle = (next: boolean) => {
    setCollapsed(next);
    if (cfg) rememberDock(cfg.key, next);
  };
  const hidden = cfg !== null && collapsed;

  return (
    <div className="relative -mb-6 flex min-h-0 flex-1 flex-col" data-game-screen>
      <div className="flex shrink-0 flex-col gap-3 empty:hidden">{header}</div>
      <DockContext.Provider value={{ el: dockEl, setCollapsible: setPortalCollapsible }}>
        <div className={cn("game-content -mx-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain px-4 py-3", contentClassName)} data-game-content>
          {children}
        </div>
      </DockContext.Provider>
      <m.div
        className="shrink-0 overflow-hidden"
        initial={false}
        animate={{ height: hidden ? 0 : "auto" }}
        transition={reduce ? FADE : SPRING}
        aria-hidden={hidden || undefined}
        data-game-dock-wrap
      >
        <m.div ref={setDockEl} initial={false} animate={reduce ? { opacity: hidden ? 0 : 1 } : { y: hidden ? "100%" : 0 }} transition={reduce ? FADE : SPRING} className="flex flex-col gap-2 pt-1 pb-2 empty:hidden" data-game-dock>
          {cfg && hasDock && (
            <div className="-mb-2 flex justify-end">
              <button type="button" aria-label="Hide keyboard" onClick={() => toggle(true)} className="relative grid h-5 w-11 place-items-center rounded-full text-muted after:absolute after:-inset-x-1 after:-inset-y-3 after:content-['']">
                <ChevronDown size={18} aria-hidden />
              </button>
            </div>
          )}
          {dock}
        </m.div>
      </m.div>
      <AnimatePresence>
        {cfg && hasDock && collapsed && (
          <m.div key="show-keyboard" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={reduce ? FADE : SPRING} className="absolute right-0 z-10" style={{ bottom: 12 + (cfg.stackAbove ?? 0) }}>
            <Pressable aria-label="Show keyboard" onClick={() => toggle(false)} className="grid size-14 place-items-center rounded-full bg-[var(--accent)] text-white shadow-lg" data-show-keyboard>
              <Keyboard size={24} aria-hidden />
            </Pressable>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Renders its children in the enclosing GameScreen's dock, keeping state where
 * it belongs. `collapsible` makes that dock a collapsible keyboard dock for as
 * long as this `<Dock>` is mounted.
 */
export function Dock({ children, collapsible }: { children: React.ReactNode; collapsible?: DockCollapsible }) {
  const { el, setCollapsible } = useContext(DockContext);
  const key = collapsible?.key;
  const roundActive = collapsible?.roundActive;
  const stackAbove = collapsible?.stackAbove;
  // Layout effect: registered before paint, so a finished round opens collapsed instead of sliding out.
  useLayoutEffect(() => {
    if (key === undefined || roundActive === undefined) return;
    setCollapsible({ key, roundActive, ...(stackAbove === undefined ? {} : { stackAbove }) });
    return () => setCollapsible(null);
  }, [key, roundActive, stackAbove, setCollapsible]);
  return el ? createPortal(children, el) : null;
}
