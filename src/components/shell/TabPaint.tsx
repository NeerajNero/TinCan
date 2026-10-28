"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { tabTimer } from "@/lib/tabTiming";

/**
 * Rendered by each tab page (never by `loading.tsx`), so it mounts exactly when
 * the tab's real content is in the tree. Two animation frames later the
 * content has painted; that closes the tap the tab bar marked.
 */
export function TabPaint() {
  const pathname = usePathname();
  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => tabTimer.painted(pathname));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [pathname]);
  return null;
}
