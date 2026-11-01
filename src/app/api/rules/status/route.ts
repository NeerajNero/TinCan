import { NextResponse } from "next/server";

import { errorResponse, guard } from "@/lib/server/guard";
import { liveRulesStatus } from "@/lib/server/rulesDrift";

export const dynamic = "force-dynamic";

/**
 * GET /api/rules/status — the version markers in the live Firestore and RTDB
 * rules next to the one this build expects, for More → Diagnostics
 * ("Rules: live 207861db · expected 207861db ✓"). Behind the full guard;
 * the daily tick runs the same check and pushes the owner on drift.
 */
export async function GET(req: Request) {
  try {
    await guard(req, "rules");
    return NextResponse.json(await liveRulesStatus(), { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return errorResponse(err, "rules");
  }
}
