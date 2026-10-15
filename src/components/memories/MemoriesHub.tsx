"use client";

import Link from "next/link";

const SECTIONS = [
  { href: "/memories/questions", emoji: "💭", title: "Daily questions", blurb: "Every answer, side by side" },
  { href: "/memories/journal", emoji: "📓", title: "Journal", blurb: "Entries from both of you" },
  { href: "/memories/capsules", emoji: "⏳", title: "Time capsules", blurb: "Sealed until the day comes" },
  { href: "/memories/envelopes", emoji: "💌", title: "Open when…", blurb: "Letters for the hard days" },
  { href: "/memories/jar", emoji: "🫙", title: "Jar", blurb: "Little notes to draw at random" },
];

export function MemoriesHub() {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3 px-1">
        <span className="text-4xl" aria-hidden>
          📸
        </span>
        <h1 className="text-3xl font-semibold">Memories</h1>
      </header>
      <div className="flex flex-col gap-3">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="card tap flex items-center gap-4 rounded-[24px] px-4 py-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent-soft text-2xl" aria-hidden>
              {s.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-heading text-lg font-semibold">{s.title}</span>
              <span className="block text-sm text-muted">{s.blurb}</span>
            </span>
          </Link>
        ))}
        <p className="px-2 text-center text-xs text-muted">Photos, the map, milestones and mood history arrive next.</p>
      </div>
    </div>
  );
}
