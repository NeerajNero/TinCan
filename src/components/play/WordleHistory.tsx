"use client";

import { format } from "date-fns";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { WordleGrid } from "@/components/play/WordleGrid";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { dateKeyToLocalDate } from "@/lib/dates";
import { recordFor } from "@/lib/db/games";
import { HISTORY_DAYS, loadWordleHistory } from "@/lib/db/wordle";
import type { PairDoc } from "@/lib/types";
import { bothFinished, guessCount, wordleDayWinner, windowStats, type WordleDay } from "@/lib/wordleResults";

interface Props {
  today: string;
  me: string;
  friend: string;
  pair: Pick<PairDoc, "records">;
  nameOf: (uid: string) => string;
  /** Today's docs, passed only once both of you finished (nothing of today shows before that). */
  todayDay: WordleDay | null;
}

/** Scoreboard (all-time, from pair.records.word) + the last 30 days, loaded on demand. */
export function WordleHistory({ today, me, friend, pair, nameOf, todayDay }: Props) {
  const rec = recordFor(pair, "word", me, friend);
  const [open, setOpen] = useState(false);
  const [past, setPast] = useState<WordleDay[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && past === null) {
      try {
        setPast(await loadWordleHistory(today));
      } catch {
        setFailed(true);
      }
    }
  }

  const days = past ? (todayDay ? [todayDay, ...past] : past) : null;
  const mineStats = days ? windowStats(days, me) : null;
  const theirStats = days ? windowStats(days, friend) : null;

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-heading text-lg font-semibold">Scoreboard</p>
        <p className="text-xs text-muted">{rec.mine + rec.theirs + rec.draws === 0 ? "First day both finish starts it" : "days won"}</p>
      </div>
      <div className="grid grid-cols-3 items-center text-center">
        <Score label={nameOf(me)} value={rec.mine} lead={rec.mine > rec.theirs} />
        <div className="flex flex-col">
          <span className="font-heading text-sm font-semibold tabular-nums text-muted">{rec.draws}</span>
          <span className="text-[10px] text-muted">draw{rec.draws === 1 ? "" : "s"}</span>
        </div>
        <Score label={nameOf(friend)} value={rec.theirs} lead={rec.theirs > rec.mine} />
      </div>

      <button type="button" onClick={() => void toggle()} aria-expanded={open} className="tap flex min-h-11 items-center gap-2 px-1 text-sm font-bold text-muted">
        <ChevronDown size={16} className={cn("transition-transform", open && "rotate-180")} />
        History · last {HISTORY_DAYS} days
      </button>
      {open && failed && <p className="px-1 text-xs text-muted">Couldn&apos;t load the history — try again later.</p>}
      {open && !failed && days === null && <p className="px-1 text-xs text-muted">Loading…</p>}
      {open && days && days.length === 0 && <p className="px-1 text-xs text-muted">No finished days yet — tomorrow&apos;s word starts the story.</p>}
      {open && days && days.length > 0 && mineStats && theirStats && (
        <>
          <p className="px-1 text-xs text-muted">
            Avg guesses: {nameOf(me)} {mineStats.avg ?? "–"} ({mineStats.solved}/{mineStats.played} solved) · {nameOf(friend)} {theirStats.avg ?? "–"} ({theirStats.solved}/{theirStats.played} solved)
          </p>
          <ul className="flex flex-col gap-1">
            {days.map((d) => {
              const mine = d.docs[me];
              const theirs = d.docs[friend];
              const winner = mine && theirs && bothFinished(mine, theirs) ? wordleDayWinner(me, friend, mine, theirs) : null;
              const isOpen = expanded === d.dateKey;
              return (
                <li key={d.dateKey}>
                  <button type="button" onClick={() => setExpanded(isOpen ? null : d.dateKey)} aria-expanded={isOpen} className="tap flex min-h-11 w-full items-center gap-2 rounded-xl bg-surface-2 px-3 py-1.5 text-left text-sm">
                    <span className="w-14 shrink-0 text-xs text-muted">{d.dateKey === today ? "Today" : format(dateKeyToLocalDate(d.dateKey), "EEE d MMM")}</span>
                    <span className="font-heading font-semibold uppercase tracking-wide">{d.word}</span>
                    <span className="flex-1" />
                    <Tally doc={mine} won={winner === me} name={nameOf(me)} />
                    <Tally doc={theirs} won={winner === friend} name={nameOf(friend)} />
                  </button>
                  {isOpen && (
                    <div className="flex justify-center gap-6 py-2">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs font-bold">{nameOf(me)}</span>
                        <WordleGrid guesses={mine?.guesses ?? []} draft="" answer={d.word} shake={0} compact />
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs font-bold">{nameOf(friend)}</span>
                        <WordleGrid guesses={theirs?.guesses ?? []} draft="" answer={d.word} shake={0} compact />
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}

function Score({ label, value, lead }: { label: string; value: number; lead: boolean }) {
  return (
    <div className="flex flex-col">
      <span className={cn("font-heading text-2xl font-semibold tabular-nums", lead && "text-[var(--accent)]")}>
        {lead && "🏆 "}
        {value}
      </span>
      <span className="truncate text-xs text-muted">{label}</span>
    </div>
  );
}

/** "3", "✗" (out of guesses), "…" (unfinished) or "–" (didn't play), with the trophy on the day's winner. */
function Tally({ doc, won, name }: { doc: WordleDay["docs"][string] | undefined; won: boolean; name: string }) {
  const n = guessCount(doc);
  const text = !doc || doc.guesses.length === 0 ? "–" : n !== null ? String(n) : doc.done ? "✗" : "…";
  return (
    <span className={cn("w-9 shrink-0 text-right font-heading font-semibold tabular-nums", won && "text-[var(--accent)]")} aria-label={`${name}: ${text}`}>
      {won && "🏆"}
      {text}
    </span>
  );
}
