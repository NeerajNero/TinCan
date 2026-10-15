/**
 * FCM token lifecycle in the browser. Always uses the Serwist worker's
 * registration (scope "/"), never Firebase's default firebase-messaging-sw.js.
 */
import { arrayRemove, arrayUnion, updateDoc } from "@/lib/firebase/fs";
import { deleteToken, getMessaging, getToken, isSupported, onMessage, type MessagePayload, type Messaging } from "firebase/messaging";

import { userRef } from "@/lib/db/refs";
import { publicEnv } from "@/lib/env";
import { getFirebaseApp } from "@/lib/firebase/client";

const TOKEN_KEY = "tincan-fcm-token";
const SW_READY_TIMEOUT_MS = 10_000;

export type PermissionState = NotificationPermission | "unsupported";

export function permissionState(): PermissionState {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

let messaging: Messaging | null = null;
async function getMessagingClient(): Promise<Messaging> {
  if (messaging) return messaging;
  if (!(await isSupported())) throw new Error("push_unsupported");
  messaging = getMessaging(getFirebaseApp());
  return messaging;
}

/** The Serwist registration. Throws when no worker is registered (e.g. `next dev`, where it's disabled). */
async function serwistRegistration(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) throw new Error("no_service_worker");
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (!existing) throw new Error("no_service_worker");
  const ready = navigator.serviceWorker.ready;
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("service_worker_timeout")), SW_READY_TIMEOUT_MS));
  return Promise.race([ready, timeout]);
}

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
function storeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // fine
  }
}

async function fetchToken(): Promise<string> {
  const [m, registration] = await Promise.all([getMessagingClient(), serwistRegistration()]);
  const token = await getToken(m, { vapidKey: publicEnv.vapidKey, serviceWorkerRegistration: registration });
  if (!token) throw new Error("no_token");
  return token;
}

export type EnableResult = { ok: true } | { ok: false; reason: "denied" | "unsupported" | "no_service_worker" | "failed" };

/** Called from a user gesture: asks permission, registers this device, flips the master switch on. */
export async function enablePush(uid: string): Promise<EnableResult> {
  if (permissionState() === "unsupported") return { ok: false, reason: "unsupported" };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };
  try {
    const token = await fetchToken();
    await updateDoc(userRef(uid), { fcmTokens: arrayUnion(token), "notif.enabled": true });
    storeToken(token);
    return { ok: true };
  } catch (err) {
    const reason = err instanceof Error && (err.message === "no_service_worker" || err.message === "service_worker_timeout") ? "no_service_worker" : "failed";
    return { ok: false, reason };
  }
}

/** Removes this device's token and flips the master switch off. */
export async function disablePush(uid: string): Promise<void> {
  const token = readStoredToken();
  try {
    const m = await getMessagingClient();
    await deleteToken(m);
  } catch {
    // Already gone, or unsupported.
  }
  await updateDoc(userRef(uid), {
    ...(token ? { fcmTokens: arrayRemove(token) } : {}),
    "notif.enabled": false,
  });
  storeToken(null);
}

/** On app open while enabled: keep the token fresh (FCM rotates them). */
export async function refreshPushToken(uid: string): Promise<void> {
  if (permissionState() !== "granted") return;
  try {
    const token = await fetchToken();
    const old = readStoredToken();
    if (old === token) return;
    await updateDoc(userRef(uid), { fcmTokens: arrayUnion(token) });
    if (old) await updateDoc(userRef(uid), { fcmTokens: arrayRemove(old) });
    storeToken(token);
  } catch {
    // Offline or no worker; try again next open.
  }
}

/** Before sign-out: this device should stop receiving the friend's pushes. */
export async function removePushTokenOnSignOut(uid: string): Promise<void> {
  const token = readStoredToken();
  if (!token) return;
  try {
    await updateDoc(userRef(uid), { fcmTokens: arrayRemove(token) });
    const m = await getMessagingClient();
    await deleteToken(m);
  } catch {
    // Best effort.
  }
  storeToken(null);
}

/** Foreground messages (tab visible). Returns an unsubscribe. */
export async function onForegroundMessage(handler: (payload: MessagePayload) => void): Promise<() => void> {
  try {
    const m = await getMessagingClient();
    return onMessage(m, handler);
  } catch {
    return () => undefined;
  }
}
