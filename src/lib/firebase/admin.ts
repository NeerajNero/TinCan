import "server-only";

import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { z } from "zod";

const serviceAccountSchema = z.object({
  project_id: z.string().min(1),
  client_email: z.string().min(1),
  private_key: z.string().min(1),
});

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set");
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid base64 JSON");
  }
  const result = serviceAccountSchema.safeParse(parsed);
  if (!result.success) throw new Error("FIREBASE_SERVICE_ACCOUNT is missing required fields");
  return result.data;
}

/** Server-side Firebase Admin app, initialised once per runtime. */
export function getAdminApp(): App {
  if (getApps().length) return getApp();
  const sa = loadServiceAccount();
  return initializeApp({
    credential: cert({
      projectId: sa.project_id,
      clientEmail: sa.client_email,
      privateKey: sa.private_key,
    }),
    projectId: sa.project_id,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  });
}

export const adminAuth = () => getAuth(getAdminApp());
export const adminDb = () => getFirestore(getAdminApp());
export const adminRtdb = () => getDatabase(getAdminApp());
export const adminMessaging = () => getMessaging(getAdminApp());

export class AuthError extends Error {
  readonly status = 401;
}

/** Verifies the `Authorization: Bearer <Firebase ID token>` header of a request. */
export async function verifyBearer(req: Request): Promise<DecodedIdToken> {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) throw new AuthError("Missing bearer token");
  try {
    return await adminAuth().verifyIdToken(match[1]);
  } catch {
    throw new AuthError("Invalid or expired token");
  }
}
