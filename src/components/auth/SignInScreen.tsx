"use client";

import { m } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { SetupScreen } from "@/components/auth/SetupScreen";
import { TakenScreen } from "@/components/auth/TakenScreen";
import { Button } from "@/components/ui/Button";
import { Splash } from "@/components/ui/Splash";
import { useAuth } from "@/hooks/useAuth";
import { signInWithGoogle } from "@/lib/auth";

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.5 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.4 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17z" />
      <path fill="#FBBC05" d="M10.5 28.7A14.6 14.6 0 0 1 9.7 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.3 0 11.7-2.1 15.5-5.7l-7.5-5.8c-2.1 1.4-4.8 2.3-8 2.3-6.3 0-11.6-3.9-13.5-9.3l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export function SignInScreen() {
  const { status, error } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "allowed") router.replace("/");
  }, [status, router]);

  async function handleSignIn() {
    setBusy(true);
    setLocalError(null);
    try {
      await signInWithGoogle();
    } catch {
      setLocalError("Google didn't pick up. Try again?");
    } finally {
      setBusy(false);
    }
  }

  if (status === "denied") return <TakenScreen />;
  if (status === "error") return <SetupScreen message={error} />;
  if (status === "loading" || status === "checking" || status === "allowed") {
    return <Splash label={status === "checking" ? "Checking whose tin can this is…" : undefined} />;
  }

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center gap-6 px-6 text-center safe-top safe-bottom"
      style={{ "--accent": "var(--accent-home)" } as React.CSSProperties}
    >
      <m.div
        aria-hidden
        className="text-8xl"
        initial={{ scale: 0.6, rotate: -10, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
      >
        🥫
      </m.div>
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold">Tincan</h1>
        <p className="text-muted">A tin-can telephone for two.</p>
      </div>
      <Button onClick={handleSignIn} disabled={busy} className="mt-4 w-full max-w-xs bg-surface text-text">
        <GoogleMark />
        {busy ? "Picking up…" : "Continue with Google"}
      </Button>
      {localError && (
        <p role="alert" className="text-sm text-muted">
          {localError}
        </p>
      )}
    </main>
  );
}
