import bundleAnalyzer from "@next/bundle-analyzer";
import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

import { buildWorkerCsp } from "./csp";


const nextConfig: NextConfig = {
  reactStrictMode: true,
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
      { key: "Permissions-Policy", value: "accelerometer=(), autoplay=(self), camera=(), display-capture=(), encrypted-media=(self), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(self), midi=(), payment=(), picture-in-picture=(self), publickey-credentials-get=(), screen-wake-lock=(), usb=(), xr-spatial-tracking=()" },
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
