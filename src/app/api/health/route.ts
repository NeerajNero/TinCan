import { NextResponse } from "next/server";

/**
 * GET /api/health — deployment self-check. Reports booleans only, never values.
 * Loads the admin module lazily so a load-time crash shows up as JSON here
 * instead of an empty 500 on /api/gate.
 */
export async function GET() {
  const env = {
    FIREBASE_SERVICE_ACCOUNT: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT),
    ALLOWED_EMAILS_count: (process.env.ALLOWED_EMAILS ?? "").split(",").filter((e) => e.trim()).length,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    NEXT_PUBLIC_FIREBASE_DATABASE_URL: Boolean(process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL),
  };

  let admin: string;
  try {
    const mod = await import("@/lib/firebase/admin");
    mod.getAdminApp();
    admin = "ok";
  } catch (err) {
    admin = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  }

  return NextResponse.json({ node: process.version, env, admin }, { headers: { "cache-control": "no-store" } });
}
