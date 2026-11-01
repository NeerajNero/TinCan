/**
 * RULES_VERSION: the hash scripts/lib/rules-version.mjs computes over the two
 * templates, the placeholder build-rules fills, the markers the live-rules
 * check reads back, and the Diagnostics line.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { extractFirestoreRulesVersion, extractRtdbRulesVersion, rulesInSync, rulesStatusLine } from "@/lib/rulesVersion";

import { RULES_TEMPLATES, rulesVersion } from "../../scripts/lib/rules-version.mjs";

const root = resolve(__dirname, "../..");

describe("RULES_VERSION", () => {
  it("is eight hex chars and the same on every call", () => {
    const v = rulesVersion(root);
    expect(v).toMatch(/^[0-9a-f]{8}$/);
    expect(rulesVersion(root)).toBe(v);
  });

  it("each template carries the placeholder once, and the rendered markers read back as the version", () => {
    const v = rulesVersion(root);
    const [firestore, rtdb] = RULES_TEMPLATES.map((t) => readFileSync(resolve(root, t), "utf8")) as [string, string];
    expect(firestore.split("__RULES_VERSION__")).toHaveLength(2);
    expect(rtdb.split("__RULES_VERSION__")).toHaveLength(2);
    expect(extractFirestoreRulesVersion(firestore.replaceAll("__RULES_VERSION__", v))).toBe(v);
    expect(extractRtdbRulesVersion(rtdb.replaceAll("__RULES_VERSION__", v))).toBe(v);
    // Before rendering, neither marker reads as a version.
    expect(extractFirestoreRulesVersion(firestore)).toBeNull();
    expect(extractRtdbRulesVersion(rtdb)).toBeNull();
  });

  it("the markers are missing from rules that predate them", () => {
    expect(extractFirestoreRulesVersion("rules_version = '2';\nservice cloud.firestore {}")).toBeNull();
    expect(extractRtdbRulesVersion('{"rules":{"presence":{".read":true}}}')).toBeNull();
    expect(extractRtdbRulesVersion('{"rules":{"meta":{"rulesVersion":{".validate":"newData.val() === \'not-a-hash\'"}}}}')).toBeNull();
  });

  it("the status line says ✓ only when both live markers equal the expected version", () => {
    expect(rulesStatusLine({ live: { rtdb: "207861db", firestore: "207861db" }, expected: "207861db" })).toBe("live 207861db · expected 207861db ✓");
    expect(rulesInSync({ live: { rtdb: "207861db", firestore: "207861db" }, expected: "207861db" })).toBe(true);
    expect(rulesStatusLine({ live: { rtdb: "1a2b3c4d", firestore: "1a2b3c4d" }, expected: "207861db" })).toBe("live 1a2b3c4d · expected 207861db ✗");
    expect(rulesStatusLine({ live: { rtdb: "207861db", firestore: null }, expected: "207861db" })).toBe("live rtdb 207861db, firestore none · expected 207861db ✗");
    expect(rulesInSync({ live: { rtdb: null, firestore: null }, expected: "207861db" })).toBe(false);
  });
});
