#!/usr/bin/env node
/**
 * Moves every Cloudinary asset under tincan/ from public ("upload") delivery to
 * "authenticated" delivery, then rewrites every Firestore doc that references
 * one: `url` becomes the signed original, and `variants` gets the signed URLs
 * from src/lib/media-variants.json (users.chatBg.photoUrl gets the w640 one).
 * Safe to re-run: already-authenticated assets are just re-signed.
 *
 *   pnpm migrate-media         → dry run: counts only, nothing changed (default)
 *   pnpm migrate-media --yes   → applies
 *
 * Prints counts and doc paths, never env values or URLs with signatures.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { configureCloudinary, firestore, message, root, SUBCOLLECTION_GROUPS } from "./lib/admin.mjs";

const SCRIPT = "migrate-media";
const YES = process.argv.includes("--yes");
const VARIANTS = JSON.parse(readFileSync(resolve(root, "src/lib/media-variants.json"), "utf8"));
const cloudinary = configureCloudinary(SCRIPT);
const db = firestore(SCRIPT);

console.log(`${SCRIPT}: ${YES ? "LIVE RUN — assets and docs will change" : "dry run (pass --yes to apply)"}`);

/* ── 1. assets ─────────────────────────────────────────────────────────── */

/** publicId → { resourceType, format, type } for everything under tincan/. */
const assets = new Map();
for (const resource_type of ["image", "video"]) {
  for (const type of ["upload", "authenticated"]) {
    let next_cursor;
    do {
      const page = await cloudinary.api.resources({ resource_type, type, prefix: "tincan/", max_results: 500, next_cursor }).catch((err) => {
        console.error(`${SCRIPT}: listing ${resource_type}/${type} failed: ${message(err)}`);
        process.exit(1);
      });
      for (const r of page.resources) assets.set(r.public_id, { resourceType: resource_type, format: r.format, type });
      next_cursor = page.next_cursor;
    } while (next_cursor);
  }
}
const toMove = [...assets].filter(([, a]) => a.type === "upload");
console.log(`assets under tincan/: ${assets.size} (public: ${toMove.length}, already authenticated: ${assets.size - toMove.length})`);

let moved = 0;
let moveFailed = 0;
if (YES) {
  for (const [publicId, a] of toMove) {
    try {
      await cloudinary.uploader.rename(publicId, publicId, { resource_type: a.resourceType, type: "upload", to_type: "authenticated", invalidate: true, overwrite: false });
      a.type = "authenticated";
      moved++;
    } catch (err) {
      moveFailed++;
      console.error(`  could not move ${publicId}: ${message(err)}`);
    }
  }
  console.log(`moved to authenticated: ${moved}${moveFailed ? `, failed: ${moveFailed}` : ""}`);
}

/* ── 2. signed URLs ────────────────────────────────────────────────────── */

function signed(publicId, purpose) {
  const a = assets.get(publicId);
  const resource_type = purpose === "audio" ? "video" : "image";
  const variants = {};
  for (const [name, transformation] of Object.entries(VARIANTS[purpose])) {
    variants[name] = cloudinary.url(publicId, {
      type: "authenticated",
      resource_type,
      secure: true,
      sign_url: true,
      ...(transformation ? { raw_transformation: transformation } : {}),
      ...(!transformation && a?.format ? { format: a.format } : {}),
    });
  }
  return variants;
}

const purposeFor = (publicId, path) => (publicId.startsWith("tincan/audio/") ? "audio" : path.endsWith(".avatar") ? "avatar" : "image");

/* ── 3. docs ───────────────────────────────────────────────────────────── */

const stats = { scanned: 0, docsToRewrite: 0, refs: 0, missingAsset: 0, byCollection: {} };
const referenced = new Set();

/** Returns a rewritten copy of `value` (or the same object when nothing changed). */
function rewrite(value, path, docPath, changes) {
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((v, i) => {
      const r = rewrite(v, `${path}[${i}]`, docPath, changes);
      if (r !== v) changed = true;
      return r;
    });
    return changed ? out : value;
  }
  if (!value || typeof value !== "object" || value.constructor?.name !== "Object") return value;
  let out = value;
  // An asset reference: { url, publicId } (messages.media, memories, journal/capsule media[], users.avatar).
  if (typeof value.publicId === "string" && value.publicId.startsWith("tincan/") && typeof value.url === "string") {
    referenced.add(value.publicId);
    stats.refs++;
    if (!assets.has(value.publicId)) {
      stats.missingAsset++;
      console.warn(`  ${docPath}${path}: asset ${value.publicId} not found in Cloudinary (left as is)`);
    } else {
      const variants = signed(value.publicId, purposeFor(value.publicId, path));
      out = { ...value, url: variants.original ?? variants.audio ?? value.url, variants };
      changes.push(path || "(doc)");
    }
  }
  // The chat background: { id: "photo", photoUrl, photoPublicId }.
  if (value.id === "photo" && typeof value.photoPublicId === "string" && assets.has(value.photoPublicId)) {
    referenced.add(value.photoPublicId);
    stats.refs++;
    out = { ...out, photoUrl: signed(value.photoPublicId, "image").w640 };
    changes.push(`${path}.photoUrl`);
  }
  for (const [k, v] of Object.entries(out)) {
    const r = rewrite(v, path ? `${path}.${k}` : `.${k}`, docPath, changes);
    if (r !== v) out = { ...out, [k]: r };
  }
  return out;
}

const writer = YES ? db.bulkWriter() : null;
async function scan(docs, label) {
  for (const snap of docs) {
    stats.scanned++;
    const changes = [];
    const data = snap.data();
    const next = rewrite(data, "", snap.ref.path, changes);
    if (next === data || changes.length === 0) continue;
    stats.docsToRewrite++;
    stats.byCollection[label] = (stats.byCollection[label] ?? 0) + 1;
    if (writer) void writer.set(snap.ref, next);
  }
}

for (const col of await db.listCollections()) {
  if (col.id === "push" || col.id === "tickLog" || col.id === "quota") continue;
  await scan((await col.get()).docs, col.id);
}
for (const group of SUBCOLLECTION_GROUPS) await scan((await db.collectionGroup(group).get()).docs, `*/${group}`);
if (writer) await writer.close();

const unreferenced = [...assets.keys()].filter((id) => !referenced.has(id)).length;
console.log(`docs scanned: ${stats.scanned}`);
console.log(`asset references found: ${stats.refs}${stats.missingAsset ? ` (${stats.missingAsset} point at missing assets)` : ""}`);
console.log(`docs ${YES ? "rewritten" : "to rewrite"}: ${stats.docsToRewrite}`);
for (const [k, n] of Object.entries(stats.byCollection).sort()) console.log(`  ${k}: ${n}`);
console.log(`assets with no doc reference (orphans, untouched apart from the move): ${unreferenced}`);
if (!YES) console.log(`would move ${toMove.length} asset(s) to authenticated delivery. Run with --yes to apply.`);
