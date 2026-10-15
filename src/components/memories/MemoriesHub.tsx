"use client";

import Link from "next/link";

const SECTIONS = [
  { href: "/memories/photos", emoji: "📷", title: "Photos", blurb: "Your timeline" },
  { href: "/memories/map", emoji: "🗺️", title: "Map", blurb: "Been & want to go" },
  { href: "/memories/milestones", emoji: "🎉", title: "Milestones", blurb: "Dates that matter" },
  { href: "/memories/journal", emoji: "📓", title: "Journal", blurb: "Both your entries" },
  { href: "/memories/jar", emoji: "🫙", title: "Jar", blurb: "Notes to draw" },
  { href: "/memories/capsules", emoji: "⏳", title: "Capsules", blurb: "Sealed for later" },
  { href: "/memories/envelopes", emoji: "💌", title: "Envelopes", blurb: "Open when…" },
  { href: "/memories/questions", emoji: "💭", title: "Daily questions", blurb: "Every answer" },
  { href: "/memories/moods", emoji: "🗓️", title: "Moods", blurb: "Month by month" },
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
      <div className="grid grid-cols-2 gap-3">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="card tap flex flex-col items-start gap-2 rounded-[24px] p-4">
            <span className="grid size-12 place-items-center rounded-full bg-accent-soft text-2xl" aria-hidden>
              {s.emoji}
            </span>
            <span className="font-heading text-lg font-semibold leading-tight">{s.title}</span>
            <span className="text-xs text-muted">{s.blurb}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
