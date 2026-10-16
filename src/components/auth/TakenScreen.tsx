"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";

/** Shown to a signed-in Google account that isn't one of the two friends. */
export function TakenScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function switchAccount() {
    setBusy(true);
    try {
      await signOut();
      router.replace("/signin");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex screen-fixed w-full max-w-[480px] flex-col items-center justify-center-safe gap-4 px-6 text-center safe-top safe-bottom">
      <div className="text-7xl" aria-hidden>
        🥫🔒
      </div>
      <h1 className="text-3xl font-semibold">This tin can is taken</h1>
      <p className="max-w-xs text-muted">
        Tincan is a private line between two friends
        {user?.email ? (
          <>
            , and <span className="font-semibold text-text">{user.email}</span> isn&apos;t one of them.
          </>
        ) : (
          "."
        )}
      </p>
      <Button onClick={switchAccount} disabled={busy} className="mt-2">
        {busy ? "One sec…" : "Use a different account"}
      </Button>
    </main>
  );
}
