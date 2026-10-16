#!/usr/bin/env node
/**
 * Backup: a dated JSON export of every Firestore collection (plus the private
 * and list-item subcollections) and a CSV of every Cloudinary media URL, into
 * ./exports/<timestamp>/ (gitignored). The Spark plan has no managed exports,
 * so this is the only backup there is. Run it now and then.
 *
 *   pnpm export
 *
 * Firestore types are tagged so they can be restored faithfully:
 *   { "__type": "timestamp", "iso": "…" }, { "__type": "ref", "path": "…" }, { "__type": "geo", … }
 * The export holds private data (journal, capsule bodies, signed media URLs
 * that open the originals). Keep it somewhere only you can read.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { DocumentReference, GeoPoint, Timestamp } from "firebase-admin/firestore";

import { firestore, root, SUBCOLLECTION_GROUPS } from "./lib/admin.mjs";

const SCRIPT = "export";
const db = firestore(SCRIPT);
const stamp = new Date().toISOString().replace(/:/g, "-").slice(0, 16);
const dir = resolve(root, "exports", stamp);
mkdirSync(dir, { recursive: true });

const media = [];
function plain(value, path, docPath) {
  if (value instanceof Timestamp) return { __type: "timestamp", iso: value.toDate().toISOString() };
  if (value instanceof GeoPoint) return { __type: "geo", lat: value.latitude, lng: value.longitude };
  if (value instanceof DocumentReference) return { __type: "ref", path: value.path };
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return { __type: "bytes", base64: Buffer.from(value).toString("base64") };
  if (Array.isArray(value)) return value.map((v, i) => plain(v, `${path}[${i}]`, docPath));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v, path ? `${path}.${k}` : k, docPath)]));
  if (typeof value === "string" && value.startsWith("https://res.cloudinary.com/")) media.push({ doc: docPath, field: path, url: value });
  return value;
}

const out = { exportedAt: new Date().toISOString(), collections: {} };
let total = 0;
async function take(label, docs) {
  const bucket = (out.collections[label] ??= {});
  for (const snap of docs) {
    bucket[snap.ref.path] = plain(snap.data(), "", snap.ref.path);
    total++;
  }
}
for (const col of await db.listCollections()) await take(col.id, (await col.get()).docs);
for (const group of SUBCOLLECTION_GROUPS) await take(`*/${group}`, (await db.collectionGroup(group).get()).docs);

writeFileSync(resolve(dir, "firestore.json"), JSON.stringify(out, null, 2));
const csv = (s) => `"${String(s).replace(/"/g, '""')}"`;
writeFileSync(resolve(dir, "media.csv"), ["doc,field,url", ...media.map((m) => [m.doc, m.field, m.url].map(csv).join(","))].join("\n") + "\n");

console.log(`${SCRIPT}: ${total} docs from ${Object.keys(out.collections).length} collections, ${media.length} media URLs`);
for (const [k, v] of Object.entries(out.collections).sort()) console.log(`  ${k}: ${Object.keys(v).length}`);
console.log(`written to exports/${stamp}/ (firestore.json, media.csv). Keep it private.`);
