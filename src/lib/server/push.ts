import "server-only";

import { FieldValue } from "firebase-admin/firestore";

import { systemMessageData, type SystemKind, type SystemMeta } from "@/lib/chat/systemKinds";
import { adminDb, adminMessaging, adminRtdb } from "@/lib/firebase/admin";
import { composePush, TOGGLE_FOR, type PushPayload, type PushType } from "@/lib/pushTypes";
import type { NotifPrefs } from "@/lib/types";

const PRUNE_EVERY = 25;
const KEEP_LOGS = 200;
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

export interface UserDocLite {
  nickname?: string;
  tz?: string;
  fcmTokens?: string[];
  notif?: Partial<NotifPrefs>;
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
 * per-type toggle, pruning dead tokens and logging to push/{id}.
 */
export async function sendPushTo(toUid: string, type: PushType, opts: SendOptions): Promise<SendResult> {
  const recipient = await loadUser(toUid);
  const note = composePush(type, opts.senderName, opts.payload);
  const base = { sent: 0, failed: 0, pruned: 0, note };

  const tokens = Array.from(new Set(recipient.fcmTokens ?? [])).filter(Boolean);
  if (recipient.notif?.enabled !== true || tokens.length === 0) return { ...base, reason: "push_off" };
  const toggle = TOGGLE_FOR[type];
  if (toggle && recipient.notif?.[toggle] === false) return { ...base, reason: "type_off" };
  if (type === "digest" && recipient.notif?.digest?.enabled !== true) return { ...base, reason: "type_off" };

  if (opts.skipWhenOnPage) {
    const presence = (await adminRtdb().ref(`presence/${toUid}`).get()).val() as { online?: boolean; page?: string } | null;
    if (presence?.online === true && presence.page === opts.skipWhenOnPage) return { ...base, reason: "in_chat" };
  }

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
