"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { TABS } from "@/lib/tabs";

type PrefetchOptions = NonNullable<Parameters<ReturnType<typeof useRouter>["prefetch"]>[1]>;
/** `PrefetchKind.FULL`: fetch the page payload too, not only up to the loading boundary (every page is dynamic because of the CSP nonce). */
const FULL = { kind: "full" as PrefetchOptions["kind"] };

/**
 * Once signed in, warm the router cache with the six tab routes during idle
 * time so the first tap on each tab is served from memory. Nothing to do in
 * development (`router.prefetch` is a no-op there).
 */
export function TabPrefetcher() {
  const router = useRouter();
  useEffect(() => {
    const run = () => {
      for (const tab of TABS) router.prefetch(tab.href, FULL);
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(run, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(run, 1500);
    return () => clearTimeout(t);
  }, [router]);
  return null;
}
