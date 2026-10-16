/**
 * Shared bootstrap for maintenance scripts: env from .env, .env.local and the
 * process (never printed), firebase-admin, Cloudinary, and safe error text.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { v2 as cloudinary } from "cloudinary";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export const root = resolve(import.meta.dirname, "..", "..");

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

function need(script, key) {
  if (!env[key]) {
    console.error(`${script}: ${key} is not set.`);
    process.exit(1);
  }
  return env[key];
}

export function firestore(script) {
  const sa = JSON.parse(Buffer.from(need(script, "FIREBASE_SERVICE_ACCOUNT"), "base64").toString("utf8"));
  initializeApp({ credential: cert(sa), projectId: sa.project_id });
  return getFirestore();
}

export function configureCloudinary(script) {
  cloudinary.config({ cloud_name: need(script, "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME"), api_key: need(script, "CLOUDINARY_API_KEY"), api_secret: need(script, "CLOUDINARY_API_SECRET"), secure: true });
  return cloudinary;
}

/** Error text without request objects (the Cloudinary SDK can attach auth headers). */
export const message = (err) => err?.error?.message ?? err?.message ?? "unknown error";

/** Subcollections the app uses: capsules/{id}/private, envelopes/{id}/private, lists/{kind}/items. */
export const SUBCOLLECTION_GROUPS = ["private", "items"];
