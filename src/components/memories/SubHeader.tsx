"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { FriendHereBadge } from "@/components/play/FriendHereBadge";

/** Back link + title for Memories sub-screens. */
export function SubHeader({ emoji, title, back = "/memories", action, screenName }: { emoji: string; title: string; back?: string; action?: React.ReactNode; screenName?: string }) {
  return (
    <header className="flex flex-col gap-1">
    <div className="flex items-center gap-2 px-1">
      <Link href={back} aria-label="Back" className="tap -ml-2 grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2">
        <ChevronLeft size={22} />
      </Link>
      <span className="text-3xl" aria-hidden>
        {emoji}
      </span>
      <h1 className="min-w-0 flex-1 truncate text-2xl font-semibold">{title}</h1>
      {action}
    </div>
    {screenName && <FriendHereBadge screenName={screenName} />}
    </header>
  );
}
