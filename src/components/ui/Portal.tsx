"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const noopSubscribe = () => () => undefined;

/** True on the client after hydration, false during SSR (no effect + setState needed). */
function useIsClient(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/**
 * Renders into document.body. Anything `position: fixed` must go through here:
 * an ancestor with a transform, filter or backdrop-filter (the chat header's
 * blur, the tab transition, the chat's viewport-sized wrapper) becomes the
 * containing block for fixed descendants, so they'd be positioned against
 * that box instead of the screen.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const client = useIsClient();
  return client ? createPortal(children, document.body) : null;
}

/** One stacking scale for everything above the shell (tab bar is z-40, Leaflet panes go up to ~700). */
export const Z = {
  scrim: 1000,
  sheet: 1001,
  overlay: 1040,
  viewer: 1050,
  confetti: 1080,
  toast: 1100,
} as const;
