import { NextResponse } from "next/server";

/**
 * GET /api/health — deployment self-check, deliberately unauthenticated (it
 * must work before sign-in does). Reports booleans and an error *name* only.
 * Loads the admin module lazily so a load-time crash shows up as JSON here
 * instead of an empty 500 on /api/gate.
 */
export async function GET() {
  const env = {
    FIREBASE_SERVICE_ACCOUNT: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT),
    ALLOWED_EMAILS_count: (process.env.ALLOWED_EMAILS ?? "").split(",").filter((e) => e.trim()).length,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    NEXT_PUBLIC_FIREBASE_DATABASE_URL: Boolean(process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL),
    CLOUDINARY_API_SECRET: Boolean(process.env.CLOUDINARY_API_SECRET),
    TICK_SECRET: Boolean(process.env.TICK_SECRET),
    GIPHY_API_KEY_optional: Boolean(process.env.GIPHY_API_KEY),
  };

  let admin: string;
  try {
    const mod = await import("@/lib/firebase/admin");
    mod.getAdminApp();
    admin = "ok";
  } catch (err) {
    // Name only: a JSON.parse message quotes part of its input, which here is the service account.
    console.error("[health] admin init failed", err);
    admin = err instanceof Error ? `failed (${err.name})` : "failed";
  }

  return NextResponse.json({ node: process.version, env, admin }, { headers: { "cache-control": "no-store" } });
}
