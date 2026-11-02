import "server-only";

import { FieldValue } from "firebase-admin/firestore";

import { systemMessageData, type SystemKind, type SystemMeta } from "@/lib/chat/systemKinds";
import { adminDb, adminMessaging, adminRtdb } from "@/lib/firebase/admin";
import { inboxRecords, shouldCollapse } from "@/lib/inbox";
import { composePush, TOGGLE_FOR, type PushNote, type PushPayload, type PushType } from "@/lib/pushTypes";
import { notifOn, type NotifPrefs } from "@/lib/types";

const PRUNE_EVERY = 25;
const KEEP_LOGS = 200;
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

export interface UserDocLite {
  nickname?: string;
  email?: string;
  tz?: string;
  fcmTokens?: string[];
  notif?: Partial<NotifPrefs>;
  /** The 24-hour note (phase 27); the 03:00 tick nulls it once expired. */
  note?: { text?: string; emoji?: string; expiresAt?: { toMillis(): number } | null } | null;
  /** The notifications bell (phase 28): `unread` is bumped here, `lastReadAt` is the owner's. */
  inbox?: { unread?: number; lastReadAt?: { toMillis(): number } | null } | null;
}

export interface SendResult {
  sent: number;
  failed: number;
  pruned: number;
  reason?: "push_off" | "type_off" | "in_chat";
  note: { title: string; body: string; url: string };
}

interface SendOptions {
  /** Nickname shown as the title for person-to-person pushes. */
  senderName: string;
  payload?: PushPayload;
  /** For "message"-like pushes: don't send while the recipient is on this page. */
  skipWhenOnPage?: string;
  /** Compute everything but send and log nothing. */
  dryRun?: boolean;
}

/** The pair's two uids, or [] before onboarding. */
export async function pairUids(): Promise<string[]> {
  const snap = await adminDb().doc("pair/main").get();
  return (snap.data()?.uids as string[] | undefined) ?? [];
}

export async function loadUser(uid: string): Promise<UserDocLite> {
  return ((await adminDb().doc(`users/${uid}`).get()).data() ?? {}) as UserDocLite;
}

/**
 * Send one data-only push to one person, honouring their master switch and
 * per-type toggle, pruning dead tokens and logging to push/{id}. Whatever the
 * switches say, the composed note also lands in the person's inbox (phase 28)
 * unless they are already on the page it points at.
 */
export async function sendPushTo(toUid: string, type: PushType, opts: SendOptions): Promise<SendResult> {
  const recipient = await loadUser(toUid);
  const note = composePush(type, opts.senderName, opts.payload);
  const base = { sent: 0, failed: 0, pruned: 0, note };

  if (opts.skipWhenOnPage) {
    const presence = (await adminRtdb().ref(`presence/${toUid}`).get()).val() as { online?: boolean; page?: string } | null;
    if (presence?.online === true && presence.page === opts.skipWhenOnPage) return { ...base, reason: "in_chat" };
  }

  if (!opts.dryRun && recipient.email) {
    await recordInbox(toUid, recipient, type, note).catch((err: unknown) => console.error("[inbox]", err instanceof Error ? err.name : "error"));
  }

  const tokens = Array.from(new Set(recipient.fcmTokens ?? [])).filter(Boolean);
  if (recipient.notif?.enabled !== true || tokens.length === 0) return { ...base, reason: "push_off" };
  const toggle = TOGGLE_FOR[type];
  if (toggle && !notifOn(recipient.notif, toggle)) return { ...base, reason: "type_off" };
  if (type === "digest" && recipient.notif?.digest?.enabled !== true) return { ...base, reason: "type_off" };

  if (opts.dryRun) return { ...base, sent: tokens.length };

  const res = await adminMessaging().sendEachForMulticast({
    tokens,
    data: { ...note, type, ...(opts.payload?.data ?? {}) },
    webpush: { headers: { Urgency: "high", TTL: "86400" } },
  });
  const dead = res.responses.flatMap((r, i) => (!r.success && r.error && DEAD_TOKEN_CODES.has(r.error.code) ? [tokens[i]] : []));
  if (dead.length) await adminDb().doc(`users/${toUid}`).update({ fcmTokens: FieldValue.arrayRemove(...dead) });
  await logPush(toUid, type, res.successCount);
  return { ...base, sent: res.successCount, failed: res.failureCount, pruned: dead.length };
}

/**
 * One inbox row per composed push (phase 28): a bursty type (messages, pings,
 * your-turn…) within ten minutes of the latest unread row of the same type
 * updates that row (count + 1, latest body, back to the top: one read, one
 * write, the badge unchanged); anything else adds a row and bumps
 * `users/{uid}.inbox.unread` in one batch. The 03:00 tick keeps 200 rows.
 */
async function recordInbox(toUid: string, recipient: UserDocLite, type: PushType, note: PushNote) {
  if (!inboxRecords(type)) return;
  const db = adminDb();
  const items = db.collection(`inbox/${toUid}/items`);
  const latestSnap = await items.orderBy("createdAt", "desc").limit(1).get();
  const latest = latestSnap.docs[0];
  const data = latest?.data() as { type?: PushType; createdAt?: { toMillis(): number } | null } | undefined;
  const lastReadMs = recipient.inbox?.lastReadAt?.toMillis() ?? null;
  if (latest && data?.type && shouldCollapse({ type: data.type, createdAtMs: data.createdAt?.toMillis() ?? 0 }, type, Date.now(), lastReadMs)) {
    await latest.ref.update({ title: note.title, body: note.body, url: note.url, count: FieldValue.increment(1), createdAt: FieldValue.serverTimestamp() });
    return;
  }
  const batch = db.batch();
  batch.set(items.doc(), { type, title: note.title, body: note.body, url: note.url, count: 1, createdAt: FieldValue.serverTimestamp() });
  batch.update(db.doc(`users/${toUid}`), { "inbox.unread": FieldValue.increment(1) });
  await batch.commit();
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

/** A system line in the chat, written by the server. */
export async function postSystemMessageAdmin(senderId: string, kind: SystemKind, text: string, meta?: SystemMeta): Promise<string> {
  const ref = await adminDb().collection("messages").add(systemMessageData(senderId, kind, text, meta, FieldValue.serverTimestamp()));
  return ref.id;
}
