import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isAllowedEmail } from "@/lib/allowlist";
import { adminDb, adminMessaging, adminRtdb, AuthError, verifyBearer } from "@/lib/firebase/admin";
import { NOTIF_KEYS, type NotifKey, type NotifPrefs } from "@/lib/types";

const bodySchema = z.object({
  type: z.enum([...NOTIF_KEYS, "test"]),
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
type Body = z.infer<typeof bodySchema>;

const PING_LINES: Record<string, string> = {
  thinking: "💭 is thinking of you",
  hug: "🤗 sent you a hug",
  highfive: "✋ high-fived you",
  wave: "👋 waved at you",
};

/** One small map from push type → what the notification says. Later phases add rows. */
function compose(type: Body["type"], senderName: string, payload: Body["payload"]): { title: string; body: string; url: string; tag: string } {
  const data = payload.data ?? {};
  switch (type) {
    case "message":
      return { title: senderName, body: (payload.body ?? "New message").slice(0, 140), url: "/chat", tag: "message" };
    case "ping":
      return { title: senderName, body: PING_LINES[data.kind ?? ""] ?? "sent you a ping", url: "/", tag: "ping" };
    case "lamp":
      return { title: senderName, body: "💡 lit your lamp", url: "/", tag: "lamp" };
    case "test":
      return { title: "Tincan", body: "Push is working 🎉", url: "/more", tag: "test" };
    default:
      return { title: payload.title ?? senderName, body: payload.body ?? "", url: data.url ?? "/", tag: type };
  }
}

const PRUNE_EVERY = 25;
const KEEP_LOGS = 200;
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

interface UserDocLite {
  nickname?: string;
  fcmTokens?: string[];
  notif?: Partial<NotifPrefs>;
}

/**
 * POST /api/push — send a data-only push to the friend (or to self for the
 * test button). Respects the master switch, per-type toggles, and skips
 * message pushes when the friend is already looking at the chat.
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

    const db = adminDb();
    const pairSnap = await db.doc("pair/main").get();
    const uids = (pairSnap.data()?.uids as string[] | undefined) ?? [];
    const friendUid = uids.find((u) => u !== token.uid) ?? null;
    const toUid = toSelf ? token.uid : friendUid;
    if (!toUid) return NextResponse.json({ sent: 0, reason: "no_friend" });
    if (payload.toUid && payload.toUid !== toUid) return NextResponse.json({ sent: 0, reason: "recipient_mismatch" });

    const [recipientSnap, senderSnap] = await Promise.all([db.doc(`users/${toUid}`).get(), db.doc(`users/${token.uid}`).get()]);
    const recipient = (recipientSnap.data() ?? {}) as UserDocLite;
    const sender = (senderSnap.data() ?? {}) as UserDocLite;

    const tokens = Array.from(new Set(recipient.fcmTokens ?? [])).filter(Boolean);
    if (recipient.notif?.enabled !== true || tokens.length === 0) return NextResponse.json({ sent: 0, reason: "push_off" });
    if (type !== "test" && recipient.notif?.[type as NotifKey] === false) return NextResponse.json({ sent: 0, reason: "type_off" });

    if (type === "message" && !toSelf) {
      const presence = (await adminRtdb().ref(`presence/${toUid}`).get()).val() as { online?: boolean; page?: string } | null;
      if (presence?.online === true && presence.page === "/chat") return NextResponse.json({ sent: 0, reason: "in_chat" });
    }

    const note = compose(type, sender.nickname || "Your friend", payload);
    const res = await adminMessaging().sendEachForMulticast({
      tokens,
      data: { ...note, type, ...(payload.data ?? {}) },
      webpush: { headers: { Urgency: "high", TTL: "86400" } },
    });

    const dead = res.responses.flatMap((r, i) => (!r.success && r.error && DEAD_TOKEN_CODES.has(r.error.code) ? [tokens[i]] : []));
    if (dead.length) await db.doc(`users/${toUid}`).update({ fcmTokens: FieldValue.arrayRemove(...dead) });

    await logPush(toUid, type, res.successCount);
    return NextResponse.json({ sent: res.successCount, failed: res.failureCount, pruned: dead.length });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[api/push]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

/** push/{id} log, kept near 200 docs. A counter in push/_meta avoids counting the collection. */
async function logPush(toUid: string, type: string, sent: number) {
  const db = adminDb();
  const meta = db.doc("push/_meta");
  await db.collection("push").add({ toUid, type, sent, sentAt: FieldValue.serverTimestamp() });
  const count = ((await meta.get()).data()?.count as number | undefined) ?? 0;
  const next = count + 1;
  if (next % PRUNE_EVERY === 0 && next > KEEP_LOGS) {
    const old = await db.collection("push").orderBy("sentAt", "asc").limit(next - KEEP_LOGS).get();
    const batch = db.batch();
    old.docs.forEach((d) => batch.delete(d.ref));
    batch.set(meta, { count: next - old.size }, { merge: true });
    await batch.commit();
  } else {
    await meta.set({ count: next }, { merge: true });
  }
}
