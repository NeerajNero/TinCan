import { NextResponse } from "next/server";

import { errorResponse, guard, GuardError } from "@/lib/server/guard";

/**
 * POST /api/gate — the allowlist gate. The guard already requires a verified,
 * allowlisted email, so reaching the body means "allowed"; a 403 means not.
 */
export async function POST(req: Request) {
  try {
    await guard(req, "gate");
    return NextResponse.json({ allowed: true });
  } catch (err) {
    if (err instanceof GuardError && err.status === 403) return NextResponse.json({ allowed: false });
    return errorResponse(err, "gate");
  }
}
