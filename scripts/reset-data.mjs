#!/usr/bin/env node
/**
 * One-off maintenance: wipe everything except the owner's account.
 *
 *   pnpm reset:dry   → counts only, nothing touched (default)
 *   pnpm reset       → performs the wipe (passes --yes)
 *
 * Owner = the FIRST email in ALLOWED_EMAILS; refuses to run if that user doc
 * is missing. Reads .env.local, then .env, then the process environment.
 * Prints uids and counts, never env values.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { v2 as cloudinary } from "cloudinary";
import { cert, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getFirestore } from "firebase-admin/firestore";

const YES = process.argv.includes("--yes");
const root = resolve(import.meta.dirname, "..");

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    let value = line.slice(eq + 1).trim();
    const quoted = /^(['"]).*\1$/.test(value);
    value = quoted ? value.slice(1, -1) : value.replace(/\s+#.*$/, "").trim();
    out[line.slice(0, eq).trim()] = value;
  }
  return out;
}
const env = { ...parseEnvFile(resolve(root, ".env")), ...parseEnvFile(resolve(root, ".env.local")), ...process.env };

function need(key) {
  if (!env[key]) {
    console.error(`reset-data: ${key} is not set.`);
    process.exit(1);
  }
  return env[key];
}

/* ── init ──────────────────────────────────────────────────────────────── */

const sa = JSON.parse(Buffer.from(need("FIREBASE_SERVICE_ACCOUNT"), "base64").toString("utf8"));
initializeApp({ credential: cert(sa), projectId: sa.project_id, databaseURL: need("NEXT_PUBLIC_FIREBASE_DATABASE_URL") });
const db = getFirestore();
const rtdb = getDatabase();
cloudinary.config({ cloud_name: need("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME"), api_key: need("CLOUDINARY_API_KEY"), api_secret: need("CLOUDINARY_API_SECRET"), secure: true });

const ownerEmail = need("ALLOWED_EMAILS").split(",")[0].trim().toLowerCase();
const mask = (e) => e.replace(/^(.).*@(.).*$/, "$1***@$2***");

const KEEP_PAIR_FIELDS = ["relationship", "theme", "roomTz", "friendsSince", "nextMeetup", "createdAt"];
const SUBCOLLECTION_GROUPS = ["private", "items"]; // capsules/*/private, envelopes/*/private, lists/*/items

console.log(`reset-data: ${YES ? "LIVE RUN — data will be deleted" : "dry run (pass --yes to wipe)"}`);

/* ── 1. owner ──────────────────────────────────────────────────────────── */

const usersSnap = await db.collection("users").get();
const owner = usersSnap.docs.find((d) => (d.data().email ?? "").toLowerCase() === ownerEmail);
if (!owner) {
  console.error(`reset-data: no users doc for the first allowlisted email (${mask(ownerEmail)}). Refusing to run.`);
  process.exit(1);
}
console.log(`owner: ${mask(ownerEmail)} → uid ${owner.id} (kept)`);

/* ── 2. Firestore collections (except users) ───────────────────────────── */

// pair/main is reset in place (step 4), not deleted, so it stays out of this list.
const collections = (await db.listCollections()).map((c) => c.id).filter((id) => id !== "users" && id !== "pair").sort();
let firestoreTotal = 0;
for (const id of collections) {
  const n = (await db.collection(id).count().get()).data().count;
  firestoreTotal += n;
  console.log(`  firestore/${id}: ${n} doc(s)`);
}
for (const group of SUBCOLLECTION_GROUPS) {
  const n = (await db.collectionGroup(group).count().get()).data().count;
  if (n) console.log(`  firestore/*/${group}: ${n} subcollection doc(s)`);
  firestoreTotal += n;
}

/* ── 3. other users ────────────────────────────────────────────────────── */

const otherUsers = usersSnap.docs.filter((d) => d.id !== owner.id);
console.log(`  users: ${otherUsers.length} other user doc(s) to delete, 1 kept`);

/* ── 4. pair/main (read now, rewritten after the wipe) ─────────────────── */

const pairSnap = await db.doc("pair/main").get();
const prevPair = pairSnap.exists ? pairSnap.data() : {};
const keptPair = Object.fromEntries(KEEP_PAIR_FIELDS.filter((k) => prevPair[k] !== undefined).map((k) => [k, prevPair[k]]));
const droppedPair = Object.keys(prevPair).filter((k) => !KEEP_PAIR_FIELDS.includes(k) && k !== "uids");
console.log(`  pair/main: keep ${Object.keys(keptPair).join(", ") || "nothing"}; drop ${droppedPair.join(", ") || "nothing"}; uids → [owner]`);

/* ── 5. RTDB ───────────────────────────────────────────────────────────── */

const rtdbRoot = await rtdb.ref().get();
const rtdbKeys = rtdbRoot.exists() ? Object.keys(rtdbRoot.val()) : [];
console.log(`  rtdb: ${rtdbKeys.length} top-level node(s)${rtdbKeys.length ? ` (${rtdbKeys.join(", ")})` : ""}`);

/* ── 6. Cloudinary ─────────────────────────────────────────────────────── */

async function countAssets(resource_type) {
  let total = 0;
  let next_cursor;
  do {
    const res = await cloudinary.api.resources({ type: "upload", prefix: "tincan/", resource_type, max_results: 500, next_cursor });
    total += res.resources.length;
    next_cursor = res.next_cursor;
  } while (next_cursor);
  return total;
}
const assetCounts = {};
for (const rt of ["image", "video"]) {
  assetCounts[rt] = await countAssets(rt).catch((err) => {
    console.log(`  cloudinary/${rt}: could not list (${err?.error?.message ?? err?.message ?? "error"})`);
    return null;
  });
  if (assetCounts[rt] !== null) console.log(`  cloudinary/${rt} under tincan/: ${assetCounts[rt]} asset(s)`);
}

if (!YES) {
  console.log(`\nDry run complete: ${firestoreTotal} Firestore doc(s), ${otherUsers.length} user doc(s), ${rtdbKeys.length} RTDB node(s), ${(assetCounts.image ?? 0) + (assetCounts.video ?? 0)} Cloudinary asset(s) would be removed. Re-run with --yes to proceed.`);
  process.exit(0);
}

/* ── wipe ──────────────────────────────────────────────────────────────── */

console.log("\nWiping…");

// (2) collections, recursively (BulkWriter batches, subcollections included)
for (const id of collections) {
  await db.recursiveDelete(db.collection(id));
  console.log(`  ✓ firestore/${id}`);
}

// (3) other users
for (const d of otherUsers) {
  await db.recursiveDelete(d.ref);
  console.log(`  ✓ users/${d.id}`);
}

// (4) pair/main → owner only, keep the configured bits, drop all mirrored data
await db.doc("pair/main").set({ ...keptPair, uids: [owner.id], roomTz: keptPair.roomTz ?? owner.data().tz ?? "UTC" });
console.log(`  ✓ pair/main reset to uids [${owner.id}]`);

// (5) RTDB root
await rtdb.ref().set(null);
console.log("  ✓ rtdb root cleared");

// (6) Cloudinary
for (const rt of ["image", "video"]) {
  if (assetCounts[rt] === 0 || assetCounts[rt] === null) continue;
  let deleted = 0;
  let res;
  do {
    res = await cloudinary.api.delete_resources_by_prefix("tincan/", { resource_type: rt, invalidate: true });
    deleted += Object.keys(res.deleted ?? {}).length;
  } while (res.partial);
  console.log(`  ✓ cloudinary/${rt}: ${deleted} asset(s) destroyed`);
}
for (const folder of ["tincan/images", "tincan/audio", "tincan"]) {
  await cloudinary.api.delete_folder(folder).catch(() => undefined);
}

console.log("\nDone. The second person's Firebase Auth account still exists; they simply onboard again on next sign-in.");
process.exit(0);
