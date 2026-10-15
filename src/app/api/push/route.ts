import { NextResponse } from "next/server";
import { z } from "zod";

import { PUSH_TYPES } from "@/lib/pushTypes";
import { errorResponse, guard, readJson } from "@/lib/server/guard";
import { loadUser, pairUids, sendPushTo } from "@/lib/server/push";

const bodySchema = z
  .object({
    type: z.enum(PUSH_TYPES),
    payload: z
      .object({
        toUid: z.string().max(128).optional(),
        title: z.string().max(120).optional(),
        body: z.string().max(500).optional(),
        data: z.record(z.string().max(40), z.string().max(500)).optional(),
      })
      .strict()
      .default({}),
    toSelf: z.boolean().optional(),
  })
  .strict();

/**
 * POST /api/push — send a data-only push to the friend (or to self for the
 * test button). The recipient's master switch, per-type toggle and "already
 * in the chat" presence are all respected in sendPushTo.
 */
export async function POST(req: Request) {
  try {
    const caller = await guard(req, "push");
    const { type, payload, toSelf } = await readJson(req, bodySchema);

    const uids = await pairUids();
    const friendUid = uids.find((u) => u !== caller.uid) ?? null;
    const toUid = toSelf ? caller.uid : friendUid;
    if (!toUid) return NextResponse.json({ sent: 0, reason: "no_friend" });
    if (payload.toUid && payload.toUid !== toUid) return NextResponse.json({ sent: 0, reason: "recipient_mismatch" });

    const sender = await loadUser(caller.uid);
    const result = await sendPushTo(toUid, type, {
      senderName: sender.nickname || "Your friend",
      payload: { title: payload.title, body: payload.body, data: payload.data },
      skipWhenOnPage: toSelf ? undefined : type === "message" ? "/chat" : type === "yourTurn" && payload.data?.url ? payload.data.url : undefined,
    });
    return NextResponse.json({ sent: result.sent, failed: result.failed, pruned: result.pruned, reason: result.reason });
  } catch (err) {
    return errorResponse(err, "push");
  }
}
