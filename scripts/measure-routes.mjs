#!/usr/bin/env node
/**
 * Initial JS per route, from a production build: starts `next start` on a spare
 * port, fetches each route's HTML, sums every /_next/static/*.js it references
 * (raw and gzip -9), prints a table and stops the server. This is the number
 * used for bundle budgets ("may grow by at most N KB gzip").
 *
 *   pnpm build && pnpm size                         # default routes
 *   pnpm size /play/watch /play/listen              # specific routes
 *   pnpm size --save before.json                    # keep a baseline (e.g. on main)
 *   pnpm size --compare before.json                 # after your change: adds a Δ column
 *
 * Env: SIZE_PORT (default 3999). Routes behind the client-side sign-in gate
 * still serve their scripts, so no sign-in is needed.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";

const root = resolve(import.meta.dirname, "..");
const DEFAULT_ROUTES = ["/", "/chat", "/play", "/play/watch", "/play/listen", "/play/radio", "/memories", "/plan", "/more"];
const port = Number(process.env.SIZE_PORT) || 3999;
const base = `http://127.0.0.1:${port}`;

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return null;
  const value = args[i + 1];
  if (!value || value.startsWith("-")) {
    console.error(`size: ${name} needs a file path`);
    process.exit(1);
  }
  args.splice(i, 2);
  return resolve(value);
};
const savePath = flag("--save");
const comparePath = flag("--compare");
const routes = args.length ? args : DEFAULT_ROUTES;

if (!existsSync(resolve(root, ".next", "BUILD_ID"))) {
  console.error("size: no production build found. Run `pnpm build` first.");
  process.exit(1);
}
const baseline = comparePath ? JSON.parse(readFileSync(comparePath, "utf8")) : null;

const server = spawn(resolve(root, "node_modules", ".bin", "next"), ["start", "-p", String(port), "-H", "127.0.0.1"], { cwd: root, stdio: ["ignore", "ignore", "pipe"] });
let serverErr = "";
server.stderr.on("data", (d) => (serverErr += d));
const stop = () => server.exitCode === null && server.kill("SIGTERM");
process.on("exit", stop);
process.on("SIGINT", () => process.exit(130));

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error(`next start exited (${server.exitCode}). ${serverErr.trim().split("\n").slice(-3).join(" ")}`);
    try {
      await fetch(base, { redirect: "manual" });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`next start didn't answer on ${base} within 30 s (port taken? set SIZE_PORT)`);
}

async function measure(route) {
  const res = await fetch(base + route);
  if (!res.ok) throw new Error(`${route}: HTTP ${res.status}`);
  const html = await res.text();
  const scripts = [...new Set([...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]))];
  let raw = 0;
  let gzip = 0;
  for (const s of scripts) {
    const body = Buffer.from(await (await fetch(base + s)).arrayBuffer());
    raw += body.length;
    gzip += gzipSync(body, { level: 9 }).length;
  }
  return { scripts: scripts.length, raw, gzip };
}

const kb = (n) => (n / 1024).toFixed(1);
try {
  await waitForServer();
  const results = {};
  for (const route of routes) results[route] = await measure(route);

  const rows = [["route", "scripts", "raw KB", "gzip KB", ...(baseline ? ["Δ gzip KB"] : [])]];
  for (const [route, r] of Object.entries(results)) {
    const before = baseline?.[route];
    const delta = before ? r.gzip - before.gzip : null;
    rows.push([route, String(r.scripts), kb(r.raw), kb(r.gzip), ...(baseline ? [delta === null ? "new" : `${delta >= 0 ? "+" : ""}${kb(delta)}`] : [])]);
  }
  const widths = rows[0].map((_, c) => Math.max(...rows.map((row) => row[c].length)));
  for (const row of rows) console.log(row.map((cell, c) => (c === 0 ? cell.padEnd(widths[c]) : cell.padStart(widths[c]))).join("  "));

  if (savePath) {
    writeFileSync(savePath, `${JSON.stringify(results, null, 2)}\n`);
    console.log(`\nsize: saved to ${savePath}`);
  }
} catch (err) {
  console.error(`size: ${err.message}`);
  process.exitCode = 1;
} finally {
  stop();
}
