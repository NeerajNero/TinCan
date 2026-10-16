import { NextResponse, type NextRequest } from "next/server";

import { buildCsp } from "../csp";

/**
 * A fresh nonce per page request, written into the Content-Security-Policy
 * (response, and request so Next stamps it on its inline scripts) and into
 * `x-nonce` for the root layout's theme script. Set CSP_REPORT_ONLY=1 to
 * send the policy as report-only while debugging a violation.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp({
    nonce,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseUrl: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    dev: process.env.NODE_ENV === "development",
  });
  const header = process.env.CSP_REPORT_ONLY === "1" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(header, csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: not API routes, static files, the worker, icons or the manifest.
      source: "/((?!api|_next/static|_next/image|serwist|icons|theme-init.js|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
