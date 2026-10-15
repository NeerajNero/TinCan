import { NextResponse } from "next/server";
import { z } from "zod";

import { isAllowedEmail } from "@/lib/allowlist";
import { AuthError, verifyBearer } from "@/lib/firebase/admin";

/**
 * POST /api/gate — the allowlist gate.
 * Verifies the caller's Firebase ID token and answers whether its email is one
 * of the two in ALLOWED_EMAILS. The list itself never leaves the server.
 */
export async function POST(req: Request) {
  try {
    const token = await verifyBearer(req);
    const email = z.email().safeParse(token.email);
    const allowed = email.success && token.email_verified !== false && isAllowedEmail(email.data);
    return NextResponse.json({ allowed });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/gate]", err);
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }
}
