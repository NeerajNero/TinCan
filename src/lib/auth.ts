import type { FirebaseError } from "firebase/app";
import {
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
} from "firebase/auth";

import { getFirebaseAuth, googleProvider } from "@/lib/firebase/client";

/** Popup failures that mean "try the redirect flow instead". */
const REDIRECT_FALLBACK_CODES = new Set([
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
]);

/** Popup failures that just mean the user changed their mind. */
const SILENT_CODES = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request"]);

function isStandalone() {
  return typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
}

/** Google sign-in: popup first, redirect when popups aren't an option. */
export async function signInWithGoogle(): Promise<void> {
  const auth = getFirebaseAuth();
  if (isStandalone()) {
    await signInWithRedirect(auth, googleProvider);
    return;
  }
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    const code = (err as FirebaseError).code ?? "";
    if (REDIRECT_FALLBACK_CODES.has(code)) {
      await signInWithRedirect(auth, googleProvider);
      return;
    }
    if (SILENT_CODES.has(code)) return;
    throw err;
  }
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(getFirebaseAuth());
}
