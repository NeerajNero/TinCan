"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PairCard } from "@/components/more/PairCard";
import { ProfileCard } from "@/components/more/ProfileCard";
import { ThemeSwitch } from "@/components/more/ThemeSwitch";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";

export function MoreScreen() {
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
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3 px-1">
        <span className="text-4xl" aria-hidden>
          ✨
        </span>
        <h1 className="text-3xl font-semibold">More</h1>
      </header>

      <ProfileCard />
      <PairCard />

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Theme</h2>
        <ThemeSwitch />
      </Card>

      <Card className="flex flex-col gap-3">
        <p className="text-sm text-muted">Notification toggles and the usage meter arrive in later phases.</p>
        <Button variant="soft" onClick={handleSignOut} disabled={busy} className="self-start">
          <LogOut size={18} aria-hidden />
          {busy ? "Signing out…" : "Sign out"}
        </Button>
      </Card>
    </div>
  );
}
