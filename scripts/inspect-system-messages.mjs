#!/usr/bin/env node
/**
 * Read-only diagnostic: scans the latest 500 chat messages and prints how many
 * there are per type, per kind/subtype, and per set of field names present,
 * plus a few shape flags (empty text, hidden, deleted). Never prints message text.
 *
 *   node scripts/inspect-system-messages.mjs [limit]
 */
import { firestore } from "./lib/admin.mjs";

const SCRIPT = "inspect-system-messages";
const LIMIT = Math.min(Number(process.argv[2]) || 500, 2000);
const db = firestore(SCRIPT);

const snap = await db.collection("messages").orderBy("createdAt", "desc").limit(LIMIT).get();

const byType = new Map();
const byShape = new Map();
const bump = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);

for (const doc of snap.docs) {
  const d = doc.data();
  const type = typeof d.type === "string" ? d.type : `<${typeof d.type}>`;
  const kind = d.kind ?? d.subtype ?? null;
  const fields = Object.keys(d).sort().join(",");
  const flags = [];
  if (typeof d.text !== "string") flags.push(`text:${typeof d.text}`);
  else if (d.text.trim() === "") flags.push("text:empty");
  if (Array.isArray(d.deletedFor) && d.deletedFor.length) flags.push(`deletedFor:${d.deletedFor.length}`);
  if (d.deletedForEveryone) flags.push("deletedForEveryone");
  if (d.createdAt == null) flags.push("createdAt:null");
  bump(byType, type);
  bump(byShape, `type=${type}${kind ? ` kind=${kind}` : ""} fields=[${fields}]${flags.length ? ` flags=[${flags.join(",")}]` : ""}`);
}

console.log(`${SCRIPT} — scanned ${snap.size} messages (newest first, limit ${LIMIT})\n`);
console.log("per type:");
for (const [k, n] of [...byType].sort((a, b) => b[1] - a[1])) console.log(`  ${k} ×${n}`);
console.log("\nper shape:");
for (const [k, n] of [...byShape].sort((a, b) => b[1] - a[1])) console.log(`  ${k} ×${n}`);
process.exit(0);
