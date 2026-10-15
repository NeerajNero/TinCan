"use client";

import { format } from "date-fns";

import { Card } from "@/components/ui/Card";
import { dateKeyToLocalDate, daysBetween } from "@/lib/dates";
import { resolveCountdown } from "@/lib/meetup";
import type { PairDoc } from "@/lib/types";

/** Days until the next meetup, or the nearest upcoming trip when none is set. Renders nothing otherwise. */
export function CountdownCard({ pair, today }: { pair: Pick<PairDoc, "nextMeetup" | "tripsSummary">; today: string }) {
  const meetup = resolveCountdown(pair, today);
  if (!meetup) return null;
  const days = daysBetween(today, meetup.date);
  const where = [meetup.label, meetup.place].filter(Boolean).join(" · ");

  const headline =
    days > 1 ? `${days} days to go` : days === 1 ? "Tomorrow!" : days === 0 ? "It's today! 🎉" : `${-days} days ago`;

  return (
    <Card className="flex items-center gap-4">
      <span className="text-4xl" aria-hidden>
        {days <= 0 ? "🎉" : meetup.source === "trip" ? "🧳" : "✈️"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-heading text-2xl font-semibold">{headline}</p>
        <p className="truncate text-sm text-muted">
          {where ? `${where} · ` : ""}
          {format(dateKeyToLocalDate(meetup.date), "EEE, d MMM")}
        </p>
      </div>
    </Card>
  );
}
