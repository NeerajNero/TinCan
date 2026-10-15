#!/usr/bin/env node
/**
 * Calls GET /api/tick?dry=1 with the secret from .env.local / .env and prints
 * what the scheduler would do. Defaults to http://localhost:3000; set
 * TICK_URL to point elsewhere (e.g. the Vercel deployment).
 */
import { existsSync, readFileSync } from "node:fs";
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
    let value = line.slice(eq + 1).trim();
    const quoted = /^(['"]).*\1$/.test(value);
    value = quoted ? value.slice(1, -1) : value.replace(/\s+#.*$/, "").trim();
    out[line.slice(0, eq).trim()] = value;
  }
  return out;
}
const env = { ...parseEnvFile(resolve(root, ".env")), ...parseEnvFile(resolve(root, ".env.local")), ...process.env };
if (!env.TICK_SECRET) {
  console.error("tick:dry — TICK_SECRET is not set.");
  process.exit(1);
}
const base = env.TICK_URL || "http://localhost:3000";
const res = await fetch(`${base}/api/tick?dry=1`, { headers: { "x-tick-secret": env.TICK_SECRET } });
const body = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`tick:dry — HTTP ${res.status}`, body);
  process.exit(1);
}
console.log(`tick:dry — ${body.now} (${body.roomTz}, local minute ${body.localMinutes}, today ${body.today})`);
if (!body.actions?.length) console.log("  nothing would happen right now");
for (const a of body.actions ?? []) {
  const r = a.result;
  const tail = r ? (r.note ? ` [${r.note}]` : ` [${r.reason ?? `${r.sent} device(s)`}] "${r.note?.title ?? r.note?.body ?? ""}"`) : "";
  console.log(`  • ${a.job}: ${a.detail}${tail}`);
}
