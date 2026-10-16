import { spawnSync } from "node:child_process";

import bundleAnalyzer from "@next/bundle-analyzer";
import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";


import { buildPermissionsPolicy, buildWorkerCsp } from "./csp";


/** Short commit id of this build (Vercel's, else local git), shown in More → Diagnostics. */
const BUILD_ID = (process.env.VERCEL_GIT_COMMIT_SHA || spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() || "local").slice(0, 12);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
  // Cache Components is intentionally left off. Tincan renders everything on the
  // client against Firebase, and @serwist/turbopack's route handler exports the
  // classic segment configs (`dynamic`, `revalidate`) that Next 16 rejects when
  // `cacheComponents` is enabled.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    const securityHeaders = [
      // Content-Security-Policy is set per request (with a nonce) by src/proxy.ts.
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: buildPermissionsPolicy() },
    ];
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Never let a CDN pin an old service worker.
        source: "/serwist/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
          // The worker's own CSP: its runtime-cache fetches are connect-src.
          { key: process.env.CSP_REPORT_ONLY === "1" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy", value: buildWorkerCsp(process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL) },
        ],
      },
    ];
  },
};

// `pnpm analyze` (ANALYZE=true) writes the bundle report; a no-op otherwise.
const withAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

export default withAnalyzer(withSerwist(nextConfig));
