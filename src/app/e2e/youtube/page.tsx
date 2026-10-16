import { notFound } from "next/navigation";

import { YouTubeHarness } from "@/components/dev/YouTubeHarness";

/**
 * Test-only page for `pnpm test:e2e`: the real Watch player (same component,
 * loader, CSP and Permissions-Policy) without sign-in or RTDB. Served only when
 * the server runs with E2E_HARNESS=1 (Playwright's webServer sets it); a 404
 * everywhere else, including production.
 */
export default function Page() {
  if (process.env.E2E_HARNESS !== "1") notFound();
  return <YouTubeHarness />;
}
