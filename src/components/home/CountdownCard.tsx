"use client";

import { format } from "date-fns";

import { Card } from "@/components/ui/Card";
import { dateKeyToLocalDate, daysBetween } from "@/lib/dates";
import type { PairDoc } from "@/lib/types";
import { nearestCountdown } from "@/lib/upcoming";

/** Days until the nearest of the meetup, the next trip and the next countdown event (`lib/upcoming.nearestCountdown`, shared with Plan's hero). Renders nothing otherwise. */
export function CountdownCard({ pair, today }: { pair: Pick<PairDoc, "nextMeetup" | "tripsSummary" | "nextCountdown">; today: string }) {
  const meetup = nearestCountdown(pair, today);
  if (!meetup) return null;
  const days = daysBetween(today, meetup.date);
  const where = [meetup.label, meetup.place].filter(Boolean).join(" · ");

  const headline =
    days > 1 ? `${days} days to go` : days === 1 ? "Tomorrow!" : days === 0 ? "It's today! 🎉" : `${-days} days ago`;

  return (
    <Card className="flex items-center gap-4">
      <span className="text-4xl" aria-hidden>
        {days <= 0 ? "🎉" : meetup.source === "trip" ? "🧳" : meetup.source === "event" ? (meetup.emoji ?? "📅") : "✈️"}
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
