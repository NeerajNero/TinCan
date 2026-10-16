"use client";

import { m } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CityPicker } from "@/components/onboarding/CityPicker";
import { PairFullScreen } from "@/components/pair/PairFullScreen";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { completeOnboarding, PairFullError } from "@/lib/db/pair";
import type { CityPick } from "@/lib/types";

const NICKNAME_MAX = 24;

/** One screen, first sign-in only: nickname + city, then we're in. */
export function OnboardingScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [nickname, setNickname] = useState(() => (user?.displayName ?? "").split(" ")[0] ?? "");
  const [place, setPlace] = useState<CityPick | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [full, setFull] = useState(false);

  if (full) return <PairFullScreen />;

  const ready = nickname.trim().length > 0 && place !== null && !busy;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !place || !ready) return;
    setBusy(true);
    setError(null);
    try {
      await completeOnboarding(user, { nickname, place });
      router.replace("/");
    } catch (err) {
      if (err instanceof PairFullError) {
        setFull(true);
        return;
      }
      setError("Couldn't save that. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col justify-center gap-6 px-6 py-10 safe-top safe-bottom"
      style={{ "--accent": "var(--accent-home)" } as React.CSSProperties}
    >
      <m.div
        className="flex flex-col items-center gap-2 text-center"
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        <span className="text-7xl" aria-hidden>
          👋
        </span>
        <h1 className="text-3xl font-semibold">Hi, you&apos;re in!</h1>
        <p className="max-w-xs text-muted">Two quick things so your friend knows who&apos;s on the line and what time it is for you.</p>
      </m.div>

      <form onSubmit={handleSubmit} className="card flex flex-col gap-5 p-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nickname">Nickname</Label>
          <Input
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, NICKNAME_MAX))}
            placeholder="What your friend calls you"
            maxLength={NICKNAME_MAX}
            autoComplete="nickname"
            required
          />
        </div>

        <CityPicker value={place} onChange={setPlace} />

        {error && (
          <p role="alert" className="text-sm text-muted">
            {error}
          </p>
        )}

        <Button type="submit" disabled={!ready} className="w-full">
          {busy ? "Stringing you up…" : "Let's go"}
        </Button>
      </form>
    </main>
  );
}
