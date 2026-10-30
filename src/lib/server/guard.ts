import "server-only";

import { timingSafeEqual } from "node:crypto";

import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isAllowedEmail } from "@/lib/allowlist";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

/**
 * One guard for every API route: verified ID token (with revocation check),
 * verified + allowlisted email, a body-size cap, strict zod validation, an
 * in-memory per-uid token bucket, and a Firestore daily cap for the routes
 * that cost money or send to the friend. Errors to the client are minimal;
 * details go to the server log only.
 */

export type RouteKey = "push" | "media" | "sign" | "urls" | "gate" | "gif" | "games";

const DAILY_CAPS: Partial<Record<RouteKey, number>> = { push: 1000, media: 300, sign: 300, urls: 300, gif: 1000, games: 1500 };
const BUCKET: Record<RouteKey, { capacity: number; refillPerSec: number }> = {
  push: { capacity: 30, refillPerSec: 0.5 },
  media: { capacity: 15, refillPerSec: 0.25 },
  sign: { capacity: 20, refillPerSec: 0.3 },
  urls: { capacity: 20, refillPerSec: 0.3 },
  gif: { capacity: 20, refillPerSec: 1 },
  gate: { capacity: 10, refillPerSec: 0.2 },
  games: { capacity: 40, refillPerSec: 1 },
};
const MAX_BODY_BYTES = 16 * 1024;

export class GuardError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    detail?: string,
  ) {
    super(detail ?? code);
  }
}

export interface Caller {
  uid: string;
  email: string;
}

export function errorResponse(err: unknown, route: RouteKey) {
  if (err instanceof GuardError) {
    if (err.status >= 500) console.error(`[api/${route}]`, err.message);
    return NextResponse.json({ error: err.code }, { status: err.status });
  }
  console.error(`[api/${route}]`, err);
  return NextResponse.json({ error: "server_error" }, { status: 500 });
}

/* ── auth ──────────────────────────────────────────────────────────────── */

async function requireCaller(req: Request): Promise<Caller> {
  const idToken = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!idToken) throw new GuardError(401, "unauthorized", "missing bearer");
  let token;
  try {
    token = await adminAuth().verifyIdToken(idToken, true); // checkRevoked
  } catch (e) {
    throw new GuardError(401, "unauthorized", `token rejected: ${(e as Error).message}`);
  }
  if (token.email_verified !== true || !isAllowedEmail(token.email)) throw new GuardError(403, "forbidden", `email not allowed`);
  return { uid: token.uid, email: token.email as string };
}

/* ── body ──────────────────────────────────────────────────────────────── */

export async function readJson<T extends z.ZodTypeAny>(req: Request, schema: T, maxBytes = MAX_BODY_BYTES): Promise<z.infer<T>> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new GuardError(413, "too_large");
  const text = await req.text();
  if (text.length > maxBytes) throw new GuardError(413, "too_large");
  let raw: unknown = null;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new GuardError(400, "bad_request", "invalid json");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new GuardError(400, "bad_request", parsed.error.issues.map((i) => i.path.join(".") + ":" + i.code).join(","));
  return parsed.data;
}

/* ── rate limits ───────────────────────────────────────────────────────── */

const buckets = new Map<string, { tokens: number; at: number }>();

function takeToken(route: RouteKey, uid: string) {
  const { capacity, refillPerSec } = BUCKET[route];
  const key = `${route}:${uid}`;
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: capacity, at: now };
  b.tokens = Math.min(capacity, b.tokens + ((now - b.at) / 1000) * refillPerSec);
  b.at = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    throw new GuardError(429, "rate_limited", `bucket empty for ${key}`);
  }
  b.tokens -= 1;
  buckets.set(key, b);
  if (buckets.size > 500) buckets.delete(buckets.keys().next().value as string);
}

/** quota/{uid}_{yyyy-MM-dd} — admin-only doc, one counter per route. */
async function takeDaily(route: RouteKey, uid: string) {
  const cap = DAILY_CAPS[route];
  if (!cap) return;
  const day = new Date().toISOString().slice(0, 10);
  const ref = adminDb().doc(`quota/${uid}_${day}`);
  const ok = await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const used = (snap.data()?.[route] as number | undefined) ?? 0;
    if (used >= cap) return false;
    tx.set(ref, { [route]: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return true;
  });
  if (!ok) throw new GuardError(429, "daily_cap", `${route} daily cap for ${uid}`);
}

/** Auth + both rate limits in one call. */
export async function guard(req: Request, route: RouteKey): Promise<Caller> {
  const caller = await requireCaller(req);
  takeToken(route, caller.uid);
  await takeDaily(route, caller.uid);
  return caller;
}

/* ── shared secrets ────────────────────────────────────────────────────── */

export function secretMatches(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
