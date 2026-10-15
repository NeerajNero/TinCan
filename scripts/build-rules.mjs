#!/usr/bin/env node
/**
 * Fills rules/*.tmpl with the two allowlisted emails and the Firebase project id,
 * writing firestore.rules, database.rules.json and .firebaserc (all gitignored).
 *
 * Reads ALLOWED_EMAILS and NEXT_PUBLIC_FIREBASE_PROJECT_ID from the environment,
 * then .env.local, then .env. Never prints their values.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Strip an inline comment unless the value is quoted.
    const quoted = /^(['"]).*\1$/.test(value);
    if (!quoted) value = value.replace(/\s+#.*$/, "").trim();
    else value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
}

const env = {
  ...parseEnvFile(resolve(root, ".env")),
  ...parseEnvFile(resolve(root, ".env.local")),
  ...process.env,
};

const emails = (env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

if (emails.length === 0 || emails.length > 2) {
  console.error(`build-rules: ALLOWED_EMAILS must contain one or two emails (found ${emails.length}).`);
  process.exit(1);
}
if (emails.length === 1) {
  console.warn("build-rules: only one email in ALLOWED_EMAILS — add the second friend's, then rebuild and redeploy.");
}
for (const e of emails) {
  if (!/^[^\s'"\\,@]+@[^\s'"\\,@]+\.[^\s'"\\,@]+$/.test(e)) {
    console.error("build-rules: ALLOWED_EMAILS contains something that isn't a plain email address.");
    process.exit(1);
  }
}

const projectId = (env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "").trim();
const cloudName = (env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "").trim();
if (!/^[a-z0-9_-]+$/i.test(cloudName)) {
  console.error("build-rules: NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is not set or not a plain cloud name.");
  process.exit(1);
}
if (!projectId) {
  console.error("build-rules: NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set.");
  process.exit(1);
}

const q = (s) => `'${s}'`;

// Firestore: a rules list literal, used with `in`.
const firestoreList = `[${emails.map(q).join(", ")}]`;
// RTDB has no functions, so every rule inlines an OR of equality checks.
const rtdbExpr = `(${emails.map((e) => `auth.token.email === ${q(e)}`).join(" || ")})`;

function render(tmplName, outName, replacement) {
  const tmpl = readFileSync(resolve(root, "rules", tmplName), "utf8");
  if (!tmpl.includes("__ALLOWED_EMAILS__")) {
    console.error(`build-rules: ${tmplName} has no __ALLOWED_EMAILS__ placeholder.`);
    process.exit(1);
  }
  const out = tmpl.replaceAll("__ALLOWED_EMAILS__", replacement).replaceAll("__CLOUDINARY_CLOUD__", cloudName);
  if (outName.endsWith(".json")) JSON.parse(out); // fail loudly on broken JSON
  writeFileSync(resolve(root, outName), out);
  console.log(`build-rules: wrote ${outName}`);
}

render("firestore.rules.tmpl", "firestore.rules", firestoreList);
render("database.rules.json.tmpl", "database.rules.json", rtdbExpr);

writeFileSync(
  resolve(root, ".firebaserc"),
  JSON.stringify({ projects: { default: projectId } }, null, 2) + "\n",
);
console.log("build-rules: wrote .firebaserc");
