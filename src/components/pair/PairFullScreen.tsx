"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";

interface PairFullScreenProps {
  title?: string;
  message?: string;
}

/** The pair already has two other people, or the pair documents can't be read. */
export function PairFullScreen({
  title = "This tin can is already in use",
  message = "Two friends are already on this line, and this account isn't one of them.",
}: PairFullScreenProps) {
  const { signOut } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut();
      router.replace("/signin");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center gap-4 px-6 text-center safe-top safe-bottom">
      <div className="text-7xl" aria-hidden>
        🥫🥫
      </div>
      <h1 className="text-3xl font-semibold">{title}</h1>
      <p className="max-w-xs text-muted">{message}</p>
      <Button onClick={handleSignOut} disabled={busy} className="mt-2">
        {busy ? "One sec…" : "Sign out"}
      </Button>
    </main>
  );
}
