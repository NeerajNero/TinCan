/**
 * Browser Firebase singletons. Only call these from client components, inside
 * effects or event handlers — never at module scope of something that is SSR'd.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

import { publicEnv } from "@/lib/env";

let auth: Auth | undefined;
let db: Firestore | undefined;
let rtdb: Database | undefined;

export function getFirebaseApp(): FirebaseApp {
  if (getApps().length) return getApp();
  return initializeApp(publicEnv.firebase);
}

export function getFirebaseAuth(): Auth {
  auth ??= getAuth(getFirebaseApp());
  return auth;
}

/** Firestore with offline persistence (multi-tab) in the browser. */
export function getDb(): Firestore {
  if (db) return db;
  const app = getFirebaseApp();
  if (typeof window === "undefined") {
    db = getFirestore(app);
    return db;
  }
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // Already initialised (e.g. after HMR) — reuse the existing instance.
    db = getFirestore(app);
  }
  return db;
}

/**
 * The RTDB SDK remembers one failed WebSocket forever (localStorage
 * `firebase:previous_websocket_failure`) and from then on starts every session
 * with long-polling on that device. Clear it before the first connection so
 * each launch tries the WebSocket first; if it really fails, the SDK falls back
 * (and the CSP allows long-polling) and sets the flag again for this session.
 */
const WS_FAILURE_KEY = "firebase:previous_websocket_failure";

export function getRtdb(): Database {
  if (!rtdb) {
    try {
      localStorage.removeItem(WS_FAILURE_KEY);
    } catch {
      // storage blocked; the SDK treats that as "failed" anyway
    }
    rtdb = getDatabase(getFirebaseApp());
  }
  return rtdb;
}

/** For More → Diagnostics: is this device currently pinned to long-polling? */
export function rtdbPrefersLongPolling(): boolean {
  try {
    return localStorage.getItem(WS_FAILURE_KEY) === "true";
  } catch {
    return true;
  }
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
