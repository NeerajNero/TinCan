import "server-only";

import { getAdminApp, adminRtdb } from "@/lib/firebase/admin";
import { EXPECTED_RULES_VERSION, extractFirestoreRulesVersion, extractRtdbRulesVersion, type RulesStatus } from "@/lib/rulesVersion";

/**
 * The version markers in the rules that are live right now: RTDB through the
 * admin SDK's `getRules()`, Firestore through the Firebase Rules API (the
 * release `cloud.firestore` names a ruleset; its source carries the comment).
 * Both calls use the service account's own OAuth token. A failed fetch
 * surfaces as `null` for that side (and a server log), never as a throw, so
 * the tick's other jobs still run.
 */
export async function liveRulesStatus(): Promise<RulesStatus> {
  const [rtdb, firestore] = await Promise.all([liveRtdbVersion(), liveFirestoreVersion()]);
  return { live: { rtdb, firestore }, expected: EXPECTED_RULES_VERSION, checkedAt: Date.now() };
}

async function liveRtdbVersion(): Promise<string | null> {
  try {
    return extractRtdbRulesVersion(await adminRtdb().getRules());
  } catch (err) {
    console.error("[rulesDrift] rtdb getRules failed", err instanceof Error ? err.name : err);
    return null;
  }
}

const RULES_API = "https://firebaserules.googleapis.com/v1";

async function liveFirestoreVersion(): Promise<string | null> {
  try {
    const app = getAdminApp();
    const projectId = app.options.projectId;
    const token = await app.options.credential?.getAccessToken();
    if (!projectId || !token) return null;
    const headers = { authorization: `Bearer ${token.access_token}` };
    const release = (await fetchJson(`${RULES_API}/projects/${projectId}/releases/cloud.firestore`, headers)) as { rulesetName?: string };
    if (!release.rulesetName) return null;
    const ruleset = (await fetchJson(`${RULES_API}/${release.rulesetName}`, headers)) as { source?: { files?: Array<{ content?: string }> } };
    const source = (ruleset.source?.files ?? []).map((f) => f.content ?? "").join("\n");
    return extractFirestoreRulesVersion(source);
  } catch (err) {
    console.error("[rulesDrift] firestore rules fetch failed", err instanceof Error ? err.name : err);
    return null;
  }
}

async function fetchJson(url: string, headers: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
