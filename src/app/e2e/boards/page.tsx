import { notFound } from "next/navigation";

import { BoardsHarness } from "@/components/dev/BoardsHarness";

/**
 * Test-only page for `pnpm test:e2e`: every game board with a mid-game
 * position (no sign-in, no Firebase). Served only when the server runs with
 * E2E_HARNESS=1; a 404 everywhere else, including production.
 */
export default function Page() {
  if (process.env.E2E_HARNESS !== "1") notFound();
  return <BoardsHarness />;
}
