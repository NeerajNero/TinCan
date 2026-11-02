"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import type { HowToKey } from "@/content/howto";
import { activeTab } from "@/lib/tabs";

/** What a page declares for the persistent header (chore: persistent app header). */
export interface HeaderContent {
  title: React.ReactNode;
  /**
   * Sub-route: show a back arrow. It pops history when this session navigated here in-app,
   * else goes to this route (or the tab root when `true`).
   */
  back?: string | true;
  /** Right slot, before the ? and the bell. */
  actions?: React.ReactNode;
  /** One line under the title: chat's "typing…", the friend-here badge, a game's turn status. */
  subtitle?: React.ReactNode;
  /** Left slot glyph (the tab's emoji, a sub-route's emoji). */
  emoji?: string;
  /** A custom left node instead of the emoji (chat's avatar). */
  leading?: React.ReactNode;
  /** Adds the ? how-to button. */
  help?: HowToKey;
}

const ContentContext = createContext<HeaderContent | null>(null);
const SetContext = createContext<((content: HeaderContent) => void) | null>(null);
const BackContext = createContext<((fallback: string | true | undefined) => void) | null>(null);

/**
 * Holds the header content the current page declared. It keeps the last
 * content until the next page declares its own, so navigation (and a
 * `loading.tsx` in between) never shows a blank or skeleton header.
 */
export function HeaderProvider({ children }: { children: React.ReactNode }) {
  const [content, setContent] = useState<HeaderContent | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  // How many in-app navigations happened this session: back can pop history only when there is one.
  const hops = useRef(0);
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (pathname !== lastPath.current) {
      hops.current += 1;
      lastPath.current = pathname;
    }
  }, [pathname]);

  const back = useCallback(
    (fallback: string | true | undefined) => {
      if (hops.current > 0) {
        hops.current -= 1;
        router.back();
        return;
      }
      router.replace(typeof fallback === "string" ? fallback : activeTab(pathname).href);
    },
    [router, pathname],
  );

  const set = useCallback((next: HeaderContent) => setContent(next), []);
  const value = useMemo(() => content, [content]);
  return (
    <SetContext.Provider value={set}>
      <BackContext.Provider value={back}>
        <ContentContext.Provider value={value}>{children}</ContentContext.Provider>
      </BackContext.Provider>
    </SetContext.Provider>
  );
}

/**
 * Declare this page's header. Runs after every render of the caller (the
 * nodes change identity anyway), never clears on unmount: the provider keeps
 * the last content until another page declares.
 */
export function useHeader(content: HeaderContent): void {
  const set = useContext(SetContext);
  useEffect(() => {
    set?.(content);
  });
}

/** The header reads what was declared (null before the first page declares). */
export function useHeaderContent(): HeaderContent | null {
  return useContext(ContentContext);
}

export function useHeaderBack(): (fallback: string | true | undefined) => void {
  const back = useContext(BackContext);
  return back ?? (() => undefined);
}
