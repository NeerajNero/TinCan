import { NextResponse } from "next/server";
import { z } from "zod";

import { isAllowedEmail } from "@/lib/allowlist";
import { AuthError, verifyBearer } from "@/lib/firebase/admin";
import { PUSH_TYPES } from "@/lib/pushTypes";
import { loadUser, pairUids, sendPushTo } from "@/lib/server/push";

const bodySchema = z.object({
  type: z.enum(PUSH_TYPES),
  payload: z
    .object({
      toUid: z.string().optional(),
      title: z.string().max(120).optional(),
      body: z.string().max(500).optional(),
      data: z.record(z.string(), z.string()).optional(),
    })
    .default({}),
  toSelf: z.boolean().optional(),
});

/**
 * POST /api/push — send a data-only push to the friend (or to self for the
 * test button). The recipient's master switch, per-type toggle and "already
 * in the chat" presence are all respected in sendPushTo.
 */
export async function POST(req: Request) {
  try {
    const token = await verifyBearer(req);
    if (!isAllowedEmail(token.email) || token.email_verified === false) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    const { type, payload, toSelf } = parsed.data;

    const uids = await pairUids();
    const friendUid = uids.find((u) => u !== token.uid) ?? null;
    const toUid = toSelf ? token.uid : friendUid;
    if (!toUid) return NextResponse.json({ sent: 0, reason: "no_friend" });
    if (payload.toUid && payload.toUid !== toUid) return NextResponse.json({ sent: 0, reason: "recipient_mismatch" });

    const sender = await loadUser(token.uid);
    const result = await sendPushTo(toUid, type, {
      senderName: sender.nickname || "Your friend",
      payload: { title: payload.title, body: payload.body, data: payload.data },
      skipWhenOnPage: type === "message" && !toSelf ? "/chat" : undefined,
    });
    return NextResponse.json({ sent: result.sent, failed: result.failed, pruned: result.pruned, reason: result.reason });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[api/push]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
