import { notFound } from "next/navigation";

import { HeaderHarness } from "@/components/dev/HeaderHarness";

/**
 * Test-only page for `pnpm test:e2e`: the persistent app header in a stand-in
 * shell (no sign-in, no Firebase). Served only when the server runs with
 * E2E_HARNESS=1; a 404 everywhere else, including production.
 */
export default function Page() {
  if (process.env.E2E_HARNESS !== "1") notFound();
  return <HeaderHarness />;
}
