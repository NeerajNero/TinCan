import { notFound } from "next/navigation";

import { PetHarness } from "@/components/dev/PetHarness";

/**
 * Test-only page for `pnpm test:e2e`: the real pet stage and motion hook with
 * a local fake pet (no sign-in, no Firestore). Served only when the server runs
 * with E2E_HARNESS=1; a 404 everywhere else, including production.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ compact?: string }> }) {
  if (process.env.E2E_HARNESS !== "1") notFound();
  return <PetHarness compact={(await searchParams).compact === "1"} />;
}
