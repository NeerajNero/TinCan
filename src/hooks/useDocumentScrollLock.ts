"use client";

import { useEffect } from "react";

/**
 * Belt and braces for the locked document (globals.css): if anything still
 * nudges the layout viewport (Android scrolling a focused input into view when
 * the keyboard opens, a visual-viewport pan), put it back at 0,0 so the shell
 * and its tab bar stay where they are.
 */
export function useDocumentScrollLock(): void {
  useEffect(() => {
    const reset = () => {
      if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
    };
    const vv = window.visualViewport;
    vv?.addEventListener("scroll", reset);
    vv?.addEventListener("resize", reset);
    window.addEventListener("scroll", reset, { passive: true });
    reset();
    return () => {
      vv?.removeEventListener("scroll", reset);
      vv?.removeEventListener("resize", reset);
      window.removeEventListener("scroll", reset);
    };
  }, []);
}
