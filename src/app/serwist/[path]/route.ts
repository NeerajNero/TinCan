import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";

// A revision versions the precached /offline page so a stale copy is never served.
function buildRevision(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  const git = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim();
  return git || randomUUID();
}

// The worker can't read process.env at runtime, so the public Firebase config
// (needed for FCM background messages) is inlined by esbuild at build time.
const PUBLIC_FIREBASE_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;
const define = Object.fromEntries(PUBLIC_FIREBASE_KEYS.map((k) => [`process.env.${k}`, JSON.stringify(process.env[k] ?? "")]));

// Serves the bundled worker at /serwist/sw.js (scope "/", see next.config headers).
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: "src/app/sw.ts",
  additionalPrecacheEntries: [{ url: "/offline", revision: buildRevision() }],
  useNativeEsbuild: true,
  esbuildOptions: { define },
});
