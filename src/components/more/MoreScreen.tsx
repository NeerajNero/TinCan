"use client";

import { LogOut } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ThemeSwitch } from "@/components/more/ThemeSwitch";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";

export function MoreScreen() {
  const { user, signOut } = useAuth();
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

      <Card className="flex items-center gap-4">
        {user?.photoURL ? (
          <Image
            src={user.photoURL}
            alt=""
            width={56}
            height={56}
            unoptimized
            referrerPolicy="no-referrer"
            className="size-14 rounded-full bg-surface-2 object-cover"
          />
        ) : (
          <div className="grid size-14 place-items-center rounded-full bg-accent-soft text-2xl" aria-hidden>
            🙂
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Signed in as</p>
          <p className="truncate font-heading text-lg font-semibold">{user?.displayName ?? "You"}</p>
          <p className="truncate text-sm text-muted">{user?.email}</p>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Theme</h2>
        <ThemeSwitch />
      </Card>

      <Card className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          Profile, notifications, friends-since date, next meetup and the pet&apos;s name arrive in later phases.
        </p>
        <Button variant="soft" onClick={handleSignOut} disabled={busy} className="self-start">
          <LogOut size={18} aria-hidden />
          {busy ? "Signing out…" : "Sign out"}
        </Button>
      </Card>
    </div>
  );
}
