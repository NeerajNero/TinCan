"use client";

import { Button } from "@/components/ui/Button";

export function SetupScreen({ message }: { message: string | null }) {
  return (
    <main className="mx-auto flex screen-fixed w-full max-w-[480px] flex-col items-center justify-center-safe gap-4 px-6 text-center safe-top safe-bottom">
      <div className="text-7xl" aria-hidden>
        🧵
      </div>
      <h1 className="text-3xl font-semibold">Still stringing things up</h1>
      <p className="max-w-xs text-muted">{message ?? "Something isn't wired yet."}</p>
      <Button variant="soft" onClick={() => window.location.reload()} className="mt-2">
        Reload
      </Button>
    </main>
  );
}
