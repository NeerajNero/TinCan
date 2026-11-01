/**
 * RULES_VERSION on the client and server: the hash of `rules/*.tmpl` this
 * build was made from (`NEXT_PUBLIC_RULES_VERSION`, computed in
 * next.config.ts by scripts/lib/rules-version.mjs), how to read the marker
 * back out of the live rules, and the one-line status More → Diagnostics
 * shows. Pure; `lib/server/rulesDrift.ts` does the fetching.
 */

/** 8 lowercase hex chars, or "unknown" in a build that didn't compute one (tests). */
export const EXPECTED_RULES_VERSION: string = /^[0-9a-f]{8}$/.test(process.env.NEXT_PUBLIC_RULES_VERSION ?? "") ? (process.env.NEXT_PUBLIC_RULES_VERSION as string) : "unknown";

interface LiveRulesVersions {
  /** From the `.validate` on `meta/rulesVersion` in the live RTDB rules; null when the marker is missing. */
  rtdb: string | null;
  /** From the `// RULES_VERSION …` comment in the live Firestore rules; null when the marker is missing. */
  firestore: string | null;
}

export interface RulesStatus {
  live: LiveRulesVersions;
  expected: string;
  /** ms epoch of the check */
  checkedAt: number;
}

/** The marker build-rules writes at the top of firestore.rules. */
export function extractFirestoreRulesVersion(source: string): string | null {
  const m = source.match(/\/\/\s*RULES_VERSION\s+([0-9a-f]{8})\b/);
  return m?.[1] ?? null;
}

/** The marker build-rules writes as `meta/rulesVersion`'s `.validate` in database.rules.json. */
export function extractRtdbRulesVersion(source: string): string | null {
  const m = source.match(/"rulesVersion"\s*:\s*\{[^}]*newData\.val\(\)\s*===\s*'([0-9a-f]{8})'/);
  return m?.[1] ?? null;
}

/** True when both live markers equal the expected version. */
export function rulesInSync(s: Pick<RulesStatus, "live" | "expected">): boolean {
  return s.live.rtdb === s.expected && s.live.firestore === s.expected;
}

/**
 * "live 207861db · expected 207861db ✓", or on drift
 * "live 1a2b3c4d · expected 207861db ✗" / "live rtdb 1a2b3c4d, firestore none · expected 207861db ✗".
 */
export function rulesStatusLine(s: Pick<RulesStatus, "live" | "expected">): string {
  const show = (v: string | null) => v ?? "none";
  const live = s.live.rtdb === s.live.firestore ? show(s.live.rtdb) : `rtdb ${show(s.live.rtdb)}, firestore ${show(s.live.firestore)}`;
  return `live ${live} · expected ${s.expected} ${rulesInSync(s) ? "✓" : "✗"}`;
}
