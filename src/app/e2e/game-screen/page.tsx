import { notFound } from "next/navigation";

import { GameScreenHarness } from "@/components/dev/GameScreenHarness";

/**
 * Test-only page for `pnpm test:e2e`: the GameScreen composite as the daily
 * word (`?screen=word`) and Hangman (`?screen=hangman`) use it (no sign-in,
 * no Firebase). Served only when the server runs with E2E_HARNESS=1; a 404
 * everywhere else, including production.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ screen?: string }> }) {
  if (process.env.E2E_HARNESS !== "1") notFound();
  const { screen } = await searchParams;
  return <GameScreenHarness screen={screen === "hangman" ? "hangman" : "word"} />;
}
