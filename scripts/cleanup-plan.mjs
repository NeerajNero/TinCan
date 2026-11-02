#!/usr/bin/env node
/**
 * Phase 29 cleanup: the Call-time finder, Gift ideas and To-do were removed,
 * so this deletes what they left behind — every `availability/*` doc and every
 * item under `lists/gifts` and `lists/todo` (plus those two parent docs).
 *
 *   pnpm cleanup:plan          → dry run: counts only, nothing touched
 *   pnpm cleanup:plan --yes    → deletes
 *
 * Reads .env.local / .env / the environment for the service account; prints
 * counts and ids, never env values.
 */
import { firestore, message } from "./lib/admin.mjs";

const SCRIPT = "cleanup-plan";
const YES = process.argv.includes("--yes");
const db = firestore(SCRIPT);

console.log(`${SCRIPT}: ${YES ? "LIVE RUN — documents will be deleted" : "dry run (pass --yes to delete)"}`);

/** Delete a list of refs in batches of 400. */
async function wipe(refs) {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = db.batch();
    refs.slice(i, i + 400).forEach((r) => batch.delete(r));
    await batch.commit();
  }
}

let total = 0;
try {
  const targets = [
    { label: "availability", refs: (await db.collection("availability").get()).docs.map((d) => d.ref) },
    { label: "lists/gifts/items", refs: (await db.collection("lists/gifts/items").get()).docs.map((d) => d.ref) },
    { label: "lists/todo/items", refs: (await db.collection("lists/todo/items").get()).docs.map((d) => d.ref) },
  ];
  for (const kind of ["gifts", "todo"]) {
    const parent = db.doc(`lists/${kind}`);
    if ((await parent.get()).exists) targets.push({ label: `lists/${kind} (parent doc)`, refs: [parent] });
  }
  for (const t of targets) {
    console.log(`  ${t.label}: ${t.refs.length} doc(s)`);
    total += t.refs.length;
    if (YES && t.refs.length) await wipe(t.refs);
  }
  console.log(YES ? `${SCRIPT}: deleted ${total} doc(s).` : `${SCRIPT}: ${total} doc(s) would be deleted. Re-run with --yes.`);
} catch (err) {
  console.error(`${SCRIPT}: ${message(err)}`);
  process.exit(1);
}
