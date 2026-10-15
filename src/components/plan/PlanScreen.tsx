"use client";

import Link from "next/link";

import { CountdownHero } from "@/components/plan/CountdownHero";
import { useNow } from "@/hooks/useNow";
import { usePair } from "@/hooks/usePair";
import { roomDateKey } from "@/lib/dates";
import { LIST_META } from "@/lib/db/lists";
import { LIST_KINDS } from "@/lib/types";

export function PlanScreen() {
  const { pair, friend } = usePair();
  const now = useNow(60_000);
  const today = roomDateKey(pair, now);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3 px-1">
        <span className="text-4xl" aria-hidden>
          🗓️
        </span>
        <h1 className="text-3xl font-semibold">Plan</h1>
      </header>

      <CountdownHero today={today} />

      <Section href="/plan/calls" emoji="📞" title="Call-time finder" blurb="Paint when you're free; see where you overlap" />

      <div className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-muted">Lists</h2>
        <div className="grid grid-cols-2 gap-3">
          {LIST_KINDS.map((kind) => (
            <Link key={kind} href={`/plan/lists/${kind}`} className="card tap flex flex-col items-start gap-1.5 rounded-[24px] p-4">
              <span className="text-3xl" aria-hidden>
                {LIST_META[kind].emoji}
              </span>
              <span className="font-heading text-lg font-semibold leading-tight">{LIST_META[kind].title}</span>
              <span className="text-xs text-muted">{kind === "gifts" && friend ? `For ${friend.nickname} · only you see these` : LIST_META[kind].blurb}</span>
            </Link>
          ))}
        </div>
      </div>

      <Section href="/plan/trips" emoji="🧳" title="Trips" blurb="Day-by-day plans for when you're together" />
    </div>
  );
}

function Section({ href, emoji, title, blurb }: { href: string; emoji: string; title: string; blurb: string }) {
  return (
    <Link href={href} className="card tap flex items-center gap-4 rounded-[24px] px-4 py-3">
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent-soft text-2xl" aria-hidden>
        {emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-heading text-lg font-semibold">{title}</span>
        <span className="block text-sm text-muted">{blurb}</span>
      </span>
    </Link>
  );
}
