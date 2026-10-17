import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { questionFor } from "@/lib/daily";
import { daysBetween, minutesIntoDayIn, roomDateKey } from "@/lib/dates";
import { adminDb, adminRtdb } from "@/lib/firebase/admin";
import { resolveCountdown } from "@/lib/meetup";
import { secretMatches } from "@/lib/server/guard";
import { loadUser, pairUids, postSystemMessageAdmin, sendPushTo, type SendResult } from "@/lib/server/push";
import type { MilestoneDoc, PairDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Time-of-day jobs fire when now is inside [target, target + 15 min) in ROOM_TZ. */
const WINDOW_MIN = 15;
const DAILY_NUDGE_AT = 20 * 60;
const STREAK_RISK_AT = 21 * 60;
const REMINDERS_AT = 9 * 60;
const CAPSULE_LOOKBACK_MS = 48 * 60 * 60 * 1000;

interface Action {
  job: string;
  key: string;
  detail: string;
  result?: SendResult | { note: string };
}

interface Ctx {
  now: Date;
  dry: boolean;
  today: string;
  roomTz: string;
  uids: string[];
  names: Record<string, string>;
  actions: Action[];
}

function inWindow(minutes: number, target: number) {
  return minutes >= target && minutes < target + WINDOW_MIN;
}

async function alreadyRan(key: string): Promise<boolean> {
  return (await adminDb().doc(`tickLog/${key}`).get()).exists;
}

async function markRan(ctx: Ctx, key: string) {
  if (ctx.dry) return;
  await adminDb().doc(`tickLog/${key}`).set({ ranAt: FieldValue.serverTimestamp() });
}

/** Run a job once per key; the body only executes when the key is fresh. */
async function once(ctx: Ctx, job: string, key: string, body: () => Promise<string>) {
  if (await alreadyRan(key)) return;
  const detail = await body();
  ctx.actions.push({ job, key, detail });
  await markRan(ctx, key);
}

const friendOf = (ctx: Ctx, uid: string) => ctx.uids.find((u) => u !== uid) ?? uid;

async function push(ctx: Ctx, toUid: string, type: Parameters<typeof sendPushTo>[1], payload?: { title?: string; body?: string; data?: Record<string, string> }) {
  const from = friendOf(ctx, toUid);
  const result = await sendPushTo(toUid, type, { senderName: ctx.names[from] ?? "Your friend", payload, dryRun: ctx.dry });
  ctx.actions.push({ job: type, key: `${type}:${toUid}`, detail: `push → ${ctx.names[toUid] ?? toUid}`, result });
}

/* ── jobs ──────────────────────────────────────────────────────────────── */

async function deliverScheduled(ctx: Ctx) {
  const db = adminDb();
  const snap = await db.collection("scheduled").where("sentAt", "==", null).limit(100).get();
  const due = snap.docs.filter((d) => (d.data().sendAt as Timestamp).toMillis() <= ctx.now.getTime());
  for (const d of due) {
    const { senderId, text } = d.data() as { senderId: string; text: string };
    const toUid = friendOf(ctx, senderId);
    if (ctx.dry) {
      ctx.actions.push({ job: "scheduled", key: d.id, detail: `deliver "${text.slice(0, 40)}" from ${ctx.names[senderId] ?? senderId}` });
      await sendPushTo(toUid, "scheduled", { senderName: ctx.names[senderId] ?? "Your friend", payload: { body: text }, dryRun: true }).then((r) =>
        ctx.actions.push({ job: "scheduled", key: `push:${d.id}`, detail: `push → ${ctx.names[toUid] ?? toUid}`, result: r }),
      );
      continue;
    }
    const msg = await db.collection("messages").add({
      senderId,
      type: "text",
      text,
      replyTo: null,
      reactions: {},
      status: "sent",
      deliveredAt: null,
      readAt: null,
      deletedFor: [],
      deletedForEveryone: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    const result = await sendPushTo(toUid, "scheduled", { senderName: ctx.names[senderId] ?? "Your friend", payload: { body: text, data: { messageId: msg.id } } });
    await d.ref.update({ sentAt: FieldValue.serverTimestamp(), messageId: msg.id });
    ctx.actions.push({ job: "scheduled", key: d.id, detail: `delivered as message ${msg.id}`, result });
  }
}

async function dailyNudge(ctx: Ctx, minutes: number) {
  if (!inWindow(minutes, DAILY_NUDGE_AT)) return;
  await once(ctx, "daily-nudge", `daily-nudge-${ctx.today}`, async () => {
    const answers = ((await adminDb().doc(`dailyQuestions/${ctx.today}`).get()).data()?.answers ?? {}) as Record<string, unknown>;
    const missing = ctx.uids.filter((u) => !answers[u]);
    for (const uid of missing) await push(ctx, uid, "daily-nudge", { body: `“${questionFor(ctx.today).slice(0, 90)}”` });
    return missing.length ? `nudged ${missing.map((u) => ctx.names[u] ?? u).join(", ")}` : "both answered";
  });
}

async function streakRisk(ctx: Ctx, minutes: number, pair: PairDoc) {
  if (!inWindow(minutes, STREAK_RISK_AT)) return;
  await once(ctx, "streak-risk", `streak-risk-${ctx.today}`, async () => {
    const checkins = ((await adminDb().doc(`checkins/${ctx.today}`).get()).data() ?? {}) as Record<string, boolean>;
    const present = ctx.uids.filter((u) => checkins[u]);
    const [who] = present;
    if (present.length !== 1 || who === undefined) return `checked in: ${present.length}, nothing to do`;
    const other = friendOf(ctx, who);
    const count = pair.streak?.count ?? 0;
    await push(ctx, other, "streak-risk", { body: count > 0 ? `Open Tincan today to keep your ${count}-day streak 🔥` : `Open Tincan today — ${ctx.names[who] ?? "they"} already did` });
    return `warned ${ctx.names[other] ?? other}`;
  });
}

async function capsulesUnlocked(ctx: Ctx) {
  const db = adminDb();
  const snap = await db.collection("capsules").where("unlockAt", "<=", Timestamp.fromDate(ctx.now)).orderBy("unlockAt", "desc").limit(20).get();
  for (const d of snap.docs) {
    const data = d.data() as { title?: string; unlockAt: Timestamp; authorId: string };
    if (ctx.now.getTime() - data.unlockAt.toMillis() > CAPSULE_LOOKBACK_MS) continue;
    await once(ctx, "capsule-unlocked", `capsule-${d.id}`, async () => {
      for (const uid of ctx.uids) await push(ctx, uid, "capsule-unlocked", { body: `“${data.title ?? "A capsule"}” is ready to open` });
      if (!ctx.dry) await postSystemMessageAdmin(data.authorId, "capsule-unlock", `⏳ A time capsule unlocked: “${data.title ?? "untitled"}”`);
      return `unlocked “${data.title ?? d.id}”`;
    });
  }
}

async function reminders(ctx: Ctx, minutes: number, pair: PairDoc) {
  if (!inWindow(minutes, REMINDERS_AT)) return;
  await once(ctx, "reminders", `reminders-${ctx.today}`, async () => {
    const notes: string[] = [];
    const milestones = await adminDb().collection("milestones").limit(100).get();
    const [, mm, dd] = ctx.today.split("-");
    for (const d of milestones.docs) {
      const m = d.data() as Partial<MilestoneDoc>;
      if (!m.date) continue;
      const hit = m.repeatYearly ? m.date.slice(5) === `${mm}-${dd}` : m.date === ctx.today;
      if (!hit) continue;
      for (const uid of ctx.uids) await push(ctx, uid, "milestone", { title: `${m.emoji ?? "🎉"} ${m.title ?? "Milestone"}`, body: "It's today!" });
      notes.push(`milestone “${m.title}”`);
    }
    // Same resolution as the app: nextMeetup, else the nearest upcoming trip.
    const target = resolveCountdown(pair, ctx.today);
    if (target) {
      const days = daysBetween(ctx.today, target.date);
      if (days === 7 || days === 1) {
        const where = [target.label, target.place].filter(Boolean).join(" · ");
        for (const uid of ctx.uids) await push(ctx, uid, "meetup", { title: days === 1 ? "Meetup tomorrow ✈️" : "Meetup in a week ✈️", body: where || "Get ready!" });
        notes.push(`${target.source === "trip" ? "trip" : "meetup"} in ${days} day(s)`);
      }
    }
    return notes.length ? notes.join("; ") : "nothing today";
  });
}

const ABANDON_MS = 7 * 24 * 60 * 60 * 1000;

const FINISHED_LISTED_MS = 6 * 60 * 60 * 1000;

/** Finished games leave the Play list after six hours; games nobody has touched for a week end with no winner. */
async function abandonStaleGames(ctx: Ctx) {
  const snap = await adminRtdb().ref("games").orderByChild("open").equalTo(true).get();
  const games = (snap.val() ?? {}) as Record<string, { type?: string; lastMoveAt?: number; status?: string; finishedAt?: number }>;
  for (const [id, g] of Object.entries(games)) {
    if (g.status === "finished") {
      if (ctx.now.getTime() - (g.finishedAt ?? g.lastMoveAt ?? 0) < FINISHED_LISTED_MS) continue;
      ctx.actions.push({ job: "close-game", key: id, detail: `${g.type ?? "game"} finished, unlisting` });
      if (!ctx.dry) await adminRtdb().ref(`games/${id}`).update({ open: false });
      continue;
    }
    const last = g.lastMoveAt ?? 0;
    if (ctx.now.getTime() - last < ABANDON_MS) continue;
    ctx.actions.push({ job: "abandon-game", key: id, detail: `${g.type ?? "game"} (${g.status ?? "?"}) idle since ${new Date(last).toISOString()}` });
    if (!ctx.dry) await adminRtdb().ref(`games/${id}`).update({ status: "finished", open: false, endReason: "abandoned", winnerId: null });
  }
}

const PET_MIN_PER_POINT = 14.4;
const PET_WARN_MS = 2 * 60 * 60 * 1000;

/** Once a day: when hunger would hit zero within two hours, push both (petHungry toggle) and leave a chat line. */
async function petHunger(ctx: Ctx, pair: PairDoc) {
  const pet = pair.pet;
  if (!pet) {
    ctx.actions.push({ job: "pet-hungry", key: "none", detail: "no pet yet", result: { note: "skipped" } });
    return;
  }
  const emptyAt = pet.hungerAt + 100 * PET_MIN_PER_POINT * 60_000;
  if (emptyAt - ctx.now.getTime() > PET_WARN_MS) return;
  await once(ctx, "pet-hungry", `pet-hungry-${ctx.today}`, async () => {
    for (const uid of ctx.uids) await push(ctx, uid, "petHungry", { title: `${pet.name} is hungry 🍽️`, body: emptyAt <= ctx.now.getTime() ? `${pet.name}'s bowl has been empty for a while` : `${pet.name} runs out of food in under 2 hours` });
    const [first] = ctx.uids;
    if (!ctx.dry && first !== undefined) await postSystemMessageAdmin(first, "pet-hungry", `🍽️ ${pet.name} is getting hungry — someone feed them?`, { pet: pet.name });
    return `warned about ${pet.name}`;
  });
}

/* ── handler ───────────────────────────────────────────────────────────── */

/**
 * GET /api/tick — pinged every 15 minutes by cron-job.org. Header
 * x-tick-secret must match TICK_SECRET. `?dry=1` reports without writing or sending.
 */
export async function GET(req: Request) {
  if (!secretMatches(req.headers.get("x-tick-secret"), process.env.TICK_SECRET)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const now = new Date();

  try {
    const pairSnap = await adminDb().doc("pair/main").get();
    const pair = (pairSnap.data() ?? {}) as PairDoc;
    const uids = await pairUids();
    if (uids.length === 0) return NextResponse.json({ dry, now: now.toISOString(), actions: [], note: "no pair yet" });
    const roomTz = pair.roomTz || "UTC";
    const names: Record<string, string> = {};
    for (const uid of uids) names[uid] = (await loadUser(uid)).nickname ?? uid;

    const ctx: Ctx = { now, dry, today: roomDateKey({ roomTz }, now), roomTz, uids, names, actions: [] };
    const minutes = minutesIntoDayIn(roomTz, now);

    await deliverScheduled(ctx);
    await dailyNudge(ctx, minutes);
    await streakRisk(ctx, minutes, pair);
    await capsulesUnlocked(ctx);
    await reminders(ctx, minutes, pair);
    await abandonStaleGames(ctx);
    await petHunger(ctx, pair);

    // A live run answers with counts only: cron-job.org keeps response bodies in its history, and the
    // action details carry nicknames, scheduled-message text and capsule titles. Details: ?dry=1 (pnpm tick:dry).
    if (!dry) {
      const jobs: Record<string, number> = {};
      for (const a of ctx.actions) jobs[a.job] = (jobs[a.job] ?? 0) + 1;
      return NextResponse.json({ ok: true, now: now.toISOString(), actions: ctx.actions.length, jobs });
    }
    return NextResponse.json({ dry, now: now.toISOString(), roomTz, today: ctx.today, localMinutes: minutes, actions: ctx.actions });
  } catch (err) {
    console.error("[api/tick]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
