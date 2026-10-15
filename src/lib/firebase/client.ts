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

export function getRtdb(): Database {
  rtdb ??= getDatabase(getFirebaseApp());
  return rtdb;
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
