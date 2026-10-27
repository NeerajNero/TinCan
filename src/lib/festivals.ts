/**
 * The festival seed (`content/festivals.json`) and its import into milestones.
 * Fixed-date festivals (`fixed: "MM-DD"`) become one repeat-yearly milestone;
 * moveable ones (`dates` per year, `rule` for Friendship Day = first Sunday of
 * August) become one one-off milestone per listed year that hasn't passed.
 * `verify` lists the years whose lunar-calendar date should be checked by hand.
 * The seed is only the import source: once imported, a festival is an ordinary
 * milestone, edited or deleted in the app.
 */
import seed from "@/content/festivals.json";
import type { DateKey, Effect, MilestoneDoc } from "@/lib/types";

export interface FestivalSeed {
  id: string;
  title: string;
  emoji: string;
  effect: Effect;
  fixed?: string;
  dates?: Record<string, DateKey>;
  rule?: "first-sunday-august";
  verify?: string[];
}

export const FESTIVALS = seed as FestivalSeed[];

/** Years the seed covers for moveable festivals. */
const SEED_YEARS = ["2026", "2027", "2028"] as const;

const pad = (n: number) => String(n).padStart(2, "0");

/** First Sunday of August, as a dateKey (Date.UTC avoids any local-tz drift). */
export function firstSundayOfAugust(year: number): DateKey {
  const day = new Date(Date.UTC(year, 7, 1)).getUTCDay(); // 0 = Sunday
  return `${year}-08-${pad(1 + ((7 - day) % 7))}`;
}

export type FestivalMilestone = Pick<MilestoneDoc, "title" | "date" | "repeatYearly" | "emoji" | "effect" | "verify">;

/** Every milestone the seed describes (before dedupe): one yearly item per fixed festival, one one-off per year otherwise. */
export function festivalMilestones(festivals: FestivalSeed[] = FESTIVALS, years: readonly string[] = SEED_YEARS): FestivalMilestone[] {
  const out: FestivalMilestone[] = [];
  for (const f of festivals) {
    const base = { title: f.title, emoji: f.emoji, effect: f.effect };
    if (f.fixed) {
      out.push({ ...base, date: `${years[0] ?? "2026"}-${f.fixed}`, repeatYearly: true });
      continue;
    }
    for (const y of years) {
      const date = f.rule === "first-sunday-august" ? firstSundayOfAugust(Number(y)) : f.dates?.[y];
      if (date) out.push({ ...base, date, repeatYearly: false, ...(f.verify?.includes(y) ? { verify: true } : {}) });
    }
  }
  return out;
}

export interface ExistingMilestone {
  title: string;
  date: DateKey;
  repeatYearly: boolean;
}

const norm = (s: string) => s.trim().toLowerCase();

/** Already present: same title and, for yearly items, the same month-day, else the same date. */
export function alreadyPresent(existing: ExistingMilestone[], m: FestivalMilestone): boolean {
  return existing.some((e) => norm(e.title) === norm(m.title) && (m.repeatYearly || e.repeatYearly ? e.date.slice(5) === m.date.slice(5) && e.repeatYearly === m.repeatYearly : e.date === m.date));
}

/** What "Add festivals" creates: the seed minus what exists minus one-offs already in the past. */
export function planFestivalImport(existing: ExistingMilestone[], today: DateKey, festivals: FestivalSeed[] = FESTIVALS, years: readonly string[] = SEED_YEARS): FestivalMilestone[] {
  return festivalMilestones(festivals, years).filter((m) => (m.repeatYearly || m.date >= today) && !alreadyPresent(existing, m));
}

/** The years whose dates need checking, per festival, for the summary. */
export function datesToVerify(festivals: FestivalSeed[] = FESTIVALS): Array<{ title: string; date: DateKey }> {
  return festivals.flatMap((f) => (f.verify ?? []).flatMap((y) => (f.dates?.[y] ? [{ title: f.title, date: f.dates[y]! }] : [])));
}
