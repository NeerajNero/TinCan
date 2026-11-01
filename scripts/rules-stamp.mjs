#!/usr/bin/env node
/**
 * Writes the current RULES_VERSION to RTDB `meta/rulesVersion` through the
 * Firebase CLI (admin access, so the node's client `.write: false` doesn't
 * apply). Run by `pnpm rules:deploy` right after `firebase deploy`, locally
 * (firebase login) and in CI (GOOGLE_APPLICATION_CREDENTIALS). The value only
 * has to pass the `.validate` the same deploy just installed, so a stale
 * deploy makes this step fail loudly instead of stamping the wrong version.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { rulesVersion } from "./lib/rules-version.mjs";

const root = resolve(import.meta.dirname, "..");
const firebaserc = resolve(root, ".firebaserc");
if (!existsSync(firebaserc)) {
  console.error("rules-stamp: .firebaserc is missing — run `pnpm rules:build` first.");
  process.exit(1);
}
const project = JSON.parse(readFileSync(firebaserc, "utf8")).projects?.default;
if (!project) {
  console.error("rules-stamp: .firebaserc has no default project.");
  process.exit(1);
}
const version = rulesVersion(root);
const res = spawnSync("firebase", ["database:set", "-y", "--project", project, "--data", JSON.stringify(version), "/meta/rulesVersion"], { stdio: "inherit", shell: process.platform === "win32" });
if (res.status !== 0) {
  console.error(`rules-stamp: firebase database:set failed (exit ${res.status ?? "signal"}).`);
  process.exit(res.status ?? 1);
}
console.log(`rules-stamp: meta/rulesVersion = ${version}`);
