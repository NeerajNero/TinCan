import type { Metadata } from "next";

import { RetryButton } from "@/components/offline/RetryButton";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center gap-4 px-6 text-center safe-top safe-bottom">
      <div className="text-7xl" aria-hidden>
        📡
      </div>
      <h1 className="text-3xl font-semibold">No signal in the string</h1>
      <p className="max-w-xs text-muted">
        Tincan needs a connection to hear your friend. Check your network and give it another tug.
      </p>
      <RetryButton />
    </main>
  );
}
