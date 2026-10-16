"use client";

import { getRedirectResult, onAuthStateChanged, type User } from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { markOffline } from "@/hooks/usePresence";
import { signOut as doSignOut } from "@/lib/auth";
import { firebaseConfigured } from "@/lib/env";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { removePushTokenOnSignOut } from "@/lib/push";
import { errorMessage } from "@/lib/swallow";
/**
 * loading     — waiting for Firebase to restore the session
 * signed-out  — no user
 * checking    — signed in, asking /api/gate whether this email is allowed
 * allowed     — one of the two friends
 * denied      — a Google account that isn't on the allowlist
 * error       — setup problem (missing env, gate route failed)
 */
export type AuthStatus = "loading" | "signed-out" | "checking" | "allowed" | "denied" | "error";

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  error: string | null;
  /** The first allowlisted email (from /api/gate); gates owner-only screens like Diagnostics. */
  isOwner: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const gateKey = (uid: string) => `tincan-gate:${uid}`;

async function askGate(user: User): Promise<{ allowed: boolean; owner: boolean }> {
  const token = await user.getIdToken();
  const res = await fetch("/api/gate", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `gate_${res.status}`);
  }
  const data = (await res.json()) as { allowed: boolean; owner?: boolean };
  return { allowed: data.allowed, owner: data.owner === true };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  // NEXT_PUBLIC_* values are inlined at build time, so server and client agree here.
  const [status, setStatus] = useState<AuthStatus>(() => (firebaseConfigured ? "loading" : "error"));
  const [error, setError] = useState<string | null>(() =>
    firebaseConfigured ? null : "Firebase isn't configured yet — copy .env.example to .env.local and fill it in.",
  );

  useEffect(() => {
    if (!firebaseConfigured) return;

    const auth = getFirebaseAuth();
    let cancelled = false;

    // Completes a redirect-based sign-in, if one is in flight.
    getRedirectResult(auth).catch((err: unknown) => {
      if (cancelled) return;
      setStatus("error");
      setError(errorMessage(err, "Sign-in failed"));
    });

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (cancelled) return;
      setUser(u);
      setError(null);
      if (!u) {
        setStatus("signed-out");
        return;
      }
      try {
        const cached = sessionStorage.getItem(gateKey(u.uid));
        if (cached === "allowed" || cached === "owner") {
          setIsOwner(cached === "owner");
          setStatus("allowed");
          return;
        }
      } catch {
        // sessionStorage unavailable; fall through and ask the server.
      }
      setStatus("checking");
      try {
        const { allowed, owner } = await askGate(u);
        if (cancelled) return;
        if (allowed) {
          setIsOwner(owner);
          try {
            sessionStorage.setItem(gateKey(u.uid), owner ? "owner" : "allowed");
          } catch {
            // ignore
          }
          setStatus("allowed");
        } else {
          setStatus("denied");
        }
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setError(
          err instanceof Error && err.message === "server_misconfigured"
            ? "The server can't verify sign-ins yet — FIREBASE_SERVICE_ACCOUNT or ALLOWED_EMAILS is missing."
            : "Couldn't check who you are. Try again in a moment.",
        );
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    try {
      if (user) sessionStorage.removeItem(gateKey(user.uid));
    } catch {
      // ignore
    }
    // Flip presence off while we still hold credentials; onDisconnect can't
    // fire for a sign-out because the socket stays open.
    if (user) await Promise.all([markOffline(user.uid), removePushTokenOnSignOut(user.uid)]);
    await doSignOut();
  }, [user]);

  const value = useMemo(() => ({ user, status, error, isOwner, signOut }), [user, status, error, isOwner, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
