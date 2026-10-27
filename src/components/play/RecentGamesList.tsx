import { formatDistanceToNowStrict } from "date-fns";

import { gameInfo } from "@/lib/games/catalog";

/** One stored result, as read from gameResults (the `game` field is untrusted data). */
export interface RecentResultRow {
  id: string;
  game: string;
  winnerId: string | null;
  endReason?: string;
  moves?: number;
  endedAt?: { toDate: () => Date } | null;
}

function outcome(r: RecentResultRow, nameOf: (uid: string) => string): string {
  if (r.endReason === "cancelled") return "Cancelled";
  if (r.winnerId) return `${nameOf(r.winnerId)} won`;
  return r.endReason === "abandoned" ? "Abandoned" : "Draw";
}

/** Presentational list for Play → Recent games. Pure, so it's unit-tested with every result type. */
export function RecentGamesList({ rows, nameOf }: { rows: RecentResultRow[]; nameOf: (uid: string) => string }) {
  return (
    <>
      {rows.map((r) => {
        const g = gameInfo(r.game);
        const unit = g.id === "trivia" || g.id === "pictionary" ? "rounds" : g.id === "word" ? "guesses" : "moves";
        const moves = typeof r.moves === "number" ? ` · ${r.moves} ${unit}` : "";
        return (
          <div key={r.id} className="card flex items-center gap-3 rounded-[20px] px-4 py-2.5" data-game={g.id}>
            <span className="text-xl" aria-hidden>
              {g.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{outcome(r, nameOf)}</span>
              <span className="block text-xs text-muted">
                {g.name}
                {moves}
                {r.endReason === "resign" && " · resignation"}
                {r.endedAt && ` · ${formatDistanceToNowStrict(r.endedAt.toDate(), { addSuffix: true })}`}
              </span>
            </span>
          </div>
        );
      })}
    </>
  );
}
