"use client";

import Link from "next/link";

import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { EVENT_BOTH, type UserDoc } from "@/lib/types";
import { dayHeading, type AgendaDay, type AgendaItem } from "@/lib/upcoming";

interface AgendaListProps {
  days: AgendaDay[];
  today: string;
  uid: string;
  me: UserDoc;
  friend: UserDoc | null;
  /** Tapping an event row (edit / delete). */
  onEvent: (item: AgendaItem) => void;
}

/** The merged agenda grouped by day: avatar(s), emoji, title, time and note per row; today highlighted. */
export function AgendaList({ days, today, uid, me, friend, onEvent }: AgendaListProps) {
  return (
    <div className="flex flex-col gap-3">
      {days.map((day) => (
        <section key={day.date} aria-label={dayHeading(day.date, today)} className={cn("flex flex-col gap-1.5 rounded-[24px] p-3", day.isToday ? "bg-accent-soft ring-2 ring-[var(--accent)]" : "card")}>
          <h3 className={cn("px-1 text-xs font-bold tracking-wide uppercase", day.isToday ? "text-[var(--accent)]" : "text-muted")}>{dayHeading(day.date, today)}</h3>
          <ul className="flex flex-col gap-1">
            {day.items.map((item) => (
              <AgendaRow key={item.key} item={item} uid={uid} me={me} friend={friend} onEvent={onEvent} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Who({ who, uid, me, friend }: { who: string; uid: string; me: UserDoc; friend: UserDoc | null }) {
  if (who === EVENT_BOTH) {
    return (
      <span className="relative flex w-10 shrink-0 items-center" aria-label="For both of you">
        <Avatar user={me} size={26} className="rounded-full ring-2 ring-surface" />
        {friend && <Avatar user={friend} size={26} className="-ml-2 rounded-full ring-2 ring-surface" />}
      </span>
    );
  }
  const person = who === uid ? me : friend;
  return (
    <span className="flex w-10 shrink-0 justify-center" aria-label={who === uid ? "For you" : `For ${friend?.nickname ?? "your friend"}`}>
      {person ? <Avatar user={person} size={28} className="rounded-full" /> : <span className="size-7 rounded-full bg-surface-2" />}
    </span>
  );
}

const LINK_FOR: Partial<Record<AgendaItem["source"], string>> = { milestone: "/memories/milestones", festival: "/memories/milestones", trip: "/plan/trips" };

function AgendaRow({ item, uid, me, friend, onEvent }: { item: AgendaItem; uid: string; me: UserDoc; friend: UserDoc | null; onEvent: (item: AgendaItem) => void }) {
  const body = (
    <>
      <Who who={item.who} uid={uid} me={me} friend={friend} />
      <span className="text-xl leading-none" aria-hidden>
        {item.emoji}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 truncate text-[15px] font-semibold">{item.title}</span>
          {item.spanLabel && <span className="shrink-0 text-[11px] text-muted">{item.spanLabel}</span>}
          {item.countdown && (
            <span className="shrink-0 text-[11px]" aria-label="Counting down">
              ⏳
            </span>
          )}
          {item.time && <span className="ml-auto shrink-0 text-xs font-bold tabular-nums text-muted">{item.time}</span>}
        </span>
        {item.note && <span className="line-clamp-1 text-xs text-muted">{item.note}</span>}
        {item.source === "festival" && <span className="text-[11px] text-muted">Festival · not in your milestones yet</span>}
      </span>
    </>
  );
  const cls = "tap flex min-h-11 w-full items-center gap-2.5 rounded-2xl px-2 py-1.5 text-left hover:bg-surface-2";
  if (item.source === "event") {
    return (
      <li>
        <button type="button" onClick={() => onEvent(item)} className={cls} aria-label={`${item.title}, edit`}>
          {body}
        </button>
      </li>
    );
  }
  return (
    <li>
      <Link href={LINK_FOR[item.source] ?? "/plan"} className={cls}>
        {body}
      </Link>
    </li>
  );
}
