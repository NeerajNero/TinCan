/**
 * RULES_VERSION: a short content hash of the two rules templates. Embedded
 * in the deployed rules by scripts/build-rules.mjs (a comment in
 * firestore.rules, a `.validate` on meta/rulesVersion in the RTDB rules) and
 * into the app build by next.config.ts (NEXT_PUBLIC_RULES_VERSION), so the
 * tick's drift check and More → Diagnostics can tell whether the live rules
 * match the templates this build was made from. Hashing the templates, not
 * the rendered files, keeps the value independent of the allowlisted emails.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const RULES_TEMPLATES = ["rules/firestore.rules.tmpl", "rules/database.rules.json.tmpl"];

/** 8 lowercase hex chars (sha256 prefix) over both templates, in this order, joined by a newline. */
export function rulesVersion(root) {
  const h = createHash("sha256");
  for (const t of RULES_TEMPLATES) h.update(readFileSync(resolve(root, t), "utf8").replace(/\r\n/g, "\n") + "\n");
  return h.digest("hex").slice(0, 8);
}
